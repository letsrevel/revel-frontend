/**
 * Structural guard for #780 — the global keyboard-focus floor.
 *
 * The floor itself is a single `@layer base` rule in `src/app.css`. Nothing in
 * jsdom can prove a CSS outline paints, and nothing in the component tests
 * notices when a *new* call site quietly re-breaks focus visibility — which is
 * exactly how the seat-picker regression shipped. So this file reads source and
 * pins the invariants that keep the floor working.
 *
 * WHY `transition-all` IS THE THING BEING HUNTED
 *
 * `transition-all` animates `outline-color`, `outline-width` and `box-shadow` —
 * every property a focus indicator can be made of. On a focusable element it
 * therefore fades the indicator in rather than showing it at once. Both kinds of
 * focusable are affected, so the ban is unconditional:
 *
 *   - one that styles its own ring  -> `transition-all` fades that ring;
 *   - one that styles nothing       -> `transition-all` fades the app.css floor.
 *
 * The second kind is the one the floor created, and it is the easier one to
 * miss, because nothing in the element's own classes hints that it has a focus
 * indicator at all.
 *
 * KNOWN LIMITS OF STATIC SCANNING — documented rather than papered over, because
 * a guard that overclaims is worse than one with a stated gap:
 *
 *   - "Focusable" is decided from the opening tag: a natively focusable element,
 *     or any tag carrying `tabindex` / a widget `role`. A component that renders
 *     a focusable element internally without either marker (`<Foo />` whose root
 *     is a `<button>`) is invisible here.
 *   - Class strings reached through a helper function, a prop, or a runtime
 *     conditional are not resolved. Module-level `const` class strings ARE
 *     resolved (pass 1 below), because that is this codebase's dominant style
 *     for long class lists.
 *   - Nothing here proves a pixel. The keyboard walk recorded in the PR body is
 *     the evidence that the floor actually paints; this file only stops the
 *     known regressions from silently reappearing.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = join(process.cwd(), 'src');

function walk(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			// Generated API client and compiled messages carry no markup.
			if (entry.name === 'paraglide' || entry.name === 'generated') continue;
			walk(full, out);
		} else if (entry.name.endsWith('.svelte') || entry.name.endsWith('.ts')) {
			out.push(full);
		}
	}
	return out;
}

const sourceFiles = walk(SRC).filter((f) => !f.endsWith('.test.ts') && !f.endsWith('.spec.ts'));

const rel = (f: string) => relative(process.cwd(), f);
const lineOf = (text: string, index: number) => text.slice(0, index).split('\n').length;

/**
 * Blank out comments before scanning, preserving every character offset (so
 * reported line numbers stay true) by replacing content with spaces.
 *
 * This is load-bearing, not tidiness. Prose in this codebase quotes class names
 * in backticks — "`transition-shadow` (was `transition-all`)" — and a literal
 * scanner reads those backticks as template strings, so an explanatory comment
 * would report itself as an offender. The same aliasing could equally MASK a
 * real offender, so comments are removed rather than special-cased. String
 * literals are tracked so a `//` inside a URL is never mistaken for a comment.
 */
function stripComments(text: string): string {
	const out = text.split('');
	let i = 0;
	let quote: string | null = null;
	const blank = (from: number, to: number) => {
		for (let k = from; k < to && k < out.length; k++) if (out[k] !== '\n') out[k] = ' ';
	};

	while (i < text.length) {
		const c = text[i];
		if (quote) {
			if (c === '\\') i += 2;
			else {
				if (c === quote) quote = null;
				i++;
			}
			continue;
		}
		if (c === "'" || c === '"' || c === '`') {
			quote = c;
			i++;
		} else if (c === '/' && text[i + 1] === '*') {
			const end = text.indexOf('*/', i + 2);
			const stop = end === -1 ? text.length : end + 2;
			blank(i, stop);
			i = stop;
		} else if (c === '/' && text[i + 1] === '/') {
			const end = text.indexOf('\n', i);
			const stop = end === -1 ? text.length : end;
			blank(i, stop);
			i = stop;
		} else if (c === '<' && text.startsWith('<!--', i)) {
			const end = text.indexOf('-->', i + 4);
			const stop = end === -1 ? text.length : end + 3;
			blank(i, stop);
			i = stop;
		} else {
			i++;
		}
	}
	return out.join('');
}

/**
 * Concatenated string literals are the house style for long class lists
 * (`'a b ' + 'c d'`, and `cn('a b', 'c d')`). Scanning each literal in isolation
 * lets a regression hide by straddling the join, so adjacent literals are glued
 * into one logical string before matching. `+` and `,` both count as joins.
 */
function logicalClassStrings(text: string): { value: string; index: number }[] {
	const literal = /(['"`])((?:[^'"`\\\n]|\\.)*)\1/g;
	const out: { value: string; index: number }[] = [];
	let current: { value: string; index: number } | null = null;
	let previousEnd = -1;

	for (const m of text.matchAll(literal)) {
		const start = m.index ?? 0;
		const gap = previousEnd >= 0 ? text.slice(previousEnd, start) : '';
		// Glue only across a pure join: whitespace plus a single `+` or `,`.
		const isJoin = /^\s*[+,]\s*$/.test(gap);
		if (current && isJoin) {
			current.value += ' ' + m[2];
		} else {
			if (current) out.push(current);
			current = { value: m[2], index: start };
		}
		previousEnd = start + m[0].length;
	}
	if (current) out.push(current);
	return out;
}

/**
 * Exact token match, so `after:transition-all` (which animates a pseudo-element,
 * never the host's own outline or ring) is correctly not an offender.
 */
const hasBareTransitionAll = (s: string): boolean =>
	s.split(/\s+/).some((token) => token === 'transition-all');

describe('global :focus-visible floor (#780)', () => {
	const appCss = readFileSync(join(SRC, 'app.css'), 'utf-8');

	it('declares a zero-specificity, outline-based, token-driven base rule', () => {
		const rule = appCss.match(/:where\(:focus-visible\)\s*\{([^}]*)\}/);
		expect(rule, 'app.css must declare a `:where(:focus-visible)` base rule').not.toBeNull();

		const body = rule?.[1] ?? '';
		// Outline, not box-shadow: an outline is outside layout, and it occupies a
		// different property from `shadow-poster` and from selection rings.
		expect(body).toMatch(/outline:\s*2px solid/);
		expect(body).toMatch(/outline-offset:/);
		expect(body).not.toMatch(/box-shadow/);
		// Token-driven: `--ring` is `--primary`, the pair audit-brand-themes.py
		// pins at >= 3:1 against `--background` in both modes.
		expect(body).toContain('hsl(var(--ring))');
	});

	it('keeps the rule inside an `@layer base` block', () => {
		const ruleIndex = appCss.indexOf(':where(:focus-visible)');
		expect(ruleIndex, 'rule must exist').toBeGreaterThan(-1);

		// Brace-match each `@layer base { ... }` block so this actually tests
		// membership. Checking only that some opener appears earlier in the file
		// is vacuous: the first opener is near the top, so *everything* passes.
		const blocks: [number, number][] = [];
		for (const opener of appCss.matchAll(/@layer\s+base\s*\{/g)) {
			const start = (opener.index ?? 0) + opener[0].length;
			let depth = 1;
			let i = start;
			for (; i < appCss.length && depth > 0; i++) {
				if (appCss[i] === '{') depth++;
				else if (appCss[i] === '}') depth--;
			}
			blocks.push([start, i - 1]);
		}
		expect(blocks.length, 'app.css must have at least one `@layer base` block').toBeGreaterThan(0);
		expect(
			blocks.some(([start, end]) => ruleIndex > start && ruleIndex < end),
			'the `:where(:focus-visible)` rule must sit INSIDE an `@layer base { ... }` block'
		).toBe(true);
	});
});

describe('`transition-all` never sits on anything that shows a focus indicator (#780)', () => {
	/** A class string declares a focus indicator if it styles focus at all. */
	const DECLARES_FOCUS =
		/(focus|focus-visible|focus-within|peer-focus|peer-focus-visible|group-focus|group-focus-visible)(-[a-z-]+)?:(ring|outline|border|shadow)/;

	it('has no class string combining `transition-all` with focus styling', () => {
		const offenders: string[] = [];
		for (const file of sourceFiles) {
			const text = stripComments(readFileSync(file, 'utf-8'));
			for (const s of logicalClassStrings(text)) {
				if (!hasBareTransitionAll(s.value)) continue;
				if (!DECLARES_FOCUS.test(s.value)) continue;
				offenders.push(`${rel(file)}:${lineOf(text, s.index)}`);
			}
		}
		expect(
			offenders,
			'`transition-all` animates outline-color and box-shadow, so it fades the focus ring in. ' +
				'Scope the transition (transition-colors / transition-transform / transition-shadow / an ' +
				'explicit property list) on any element that styles its own focus.'
		).toEqual([]);
	});

	/**
	 * The complement, and the case the floor created: a focusable element with NO
	 * focus utilities of its own now shows the app.css outline, and
	 * `transition-all` fades that outline in. `NotificationItem`'s
	 * `role="button" tabindex={0}` Card is exactly this shape and had to be found
	 * by hand — the assertion above cannot see it, because it styles no focus.
	 */
	const FOCUSABLE_TAG = /^(button|a|input|select|textarea|summary|details)$/i;
	const WIDGET_ROLE =
		/role=["'](button|link|checkbox|radio|switch|tab|menuitem|menuitemcheckbox|menuitemradio|option|slider|spinbutton|textbox|combobox|treeitem)["']/;

	it('has no focusable element carrying `transition-all`', () => {
		const offenders: string[] = [];

		for (const file of sourceFiles.filter((f) => f.endsWith('.svelte'))) {
			const text = stripComments(readFileSync(file, 'utf-8'));

			// Pass 1: module-level class consts whose value contains the offender.
			// Long class lists live in consts in this codebase
			// (`const seatButtonClass = '...' + '...'`), so resolving them closes
			// the largest blind spot a tag-only scan would leave.
			const taintedConsts = new Set<string>();
			for (const m of text.matchAll(/\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=/g)) {
				const start = m.index ?? 0;
				const strings = logicalClassStrings(text.slice(start, start + 900));
				if (strings.some((s) => hasBareTransitionAll(s.value))) taintedConsts.add(m[1]);
			}

			// Pass 2: opening tags. `[^>]*?` stops at the tag's own `>`, which is
			// enough for the attribute soup these components use.
			for (const tag of text.matchAll(/<([A-Za-z][\w.-]*)([^>]*?)\/?>/g)) {
				const [, name, attrs] = tag;
				const focusable =
					FOCUSABLE_TAG.test(name) || /\btabindex[=\s]/.test(attrs) || WIDGET_ROLE.test(attrs);
				if (!focusable) continue;
				// An `<a>` without href is not focusable; skip to avoid noise.
				if (/^a$/i.test(name) && !/\bhref[=\s]/.test(attrs) && !/\btabindex[=\s]/.test(attrs))
					continue;

				const inTag = logicalClassStrings(attrs).some((s) => hasBareTransitionAll(s.value));
				const viaConst = [...taintedConsts].some((c) =>
					new RegExp(`class=\\{[^}]*\\b${c}\\b`).test(attrs)
				);
				if (inTag || viaConst) offenders.push(`${rel(file)}:${lineOf(text, tag.index ?? 0)}`);
			}
		}

		expect(
			offenders,
			'A focusable element with `transition-all` fades in whichever focus indicator it uses — ' +
				'its own ring, or the global outline floor in app.css when it declares none. Scope the ' +
				'transition to the properties that actually need to animate.'
		).toEqual([]);
	});
});
