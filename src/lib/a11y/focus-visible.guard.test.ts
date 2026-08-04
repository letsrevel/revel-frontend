/**
 * Structural guard for #780 — the global keyboard-focus floor.
 *
 * The floor itself is a single `@layer base` rule in `src/app.css`. Nothing in
 * jsdom can prove a CSS outline paints, and nothing in the component tests
 * notices when a *new* call site quietly re-breaks focus visibility — which is
 * exactly how the seat-picker regression shipped. So this file asserts the two
 * invariants that keep the floor working, both by reading source:
 *
 *  1. The base rule exists, is zero-specificity (`:where`), is outline-based,
 *     and is token-driven. Those four properties are the whole mechanism: a
 *     specificity-0 author rule beats the user-agent ring but loses to every
 *     Tailwind utility, so components that style their own focus keep exactly
 *     the indicator they had and nothing double-rings.
 *
 *  2. No source file puts `transition-all` on an element that also declares a
 *     focus indicator. `transition-all` animates `outline-color`/`box-shadow`,
 *     so the ring fades in instead of appearing — the indicator is present but
 *     not immediate. Scoped transitions (`transition-colors`,
 *     `transition-transform`, `transition-shadow`, explicit property lists)
 *     are all fine; only `all` is banned on a focus-styled element.
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

describe('global :focus-visible floor (#780)', () => {
	const appCss = readFileSync(join(SRC, 'app.css'), 'utf-8');

	it('declares a zero-specificity, outline-based, token-driven base rule', () => {
		const rule = appCss.match(/:where\(:focus-visible\)\s*\{([^}]*)\}/);
		expect(rule, 'app.css must declare a `:where(:focus-visible)` base rule').not.toBeNull();

		const body = rule?.[1] ?? '';
		// Outline, not box-shadow: a ring would fight `shadow-poster` and be
		// clipped by `overflow-hidden` ancestors.
		expect(body).toMatch(/outline:\s*2px solid/);
		expect(body).toMatch(/outline-offset:/);
		expect(body).not.toMatch(/box-shadow/);
		// Token-driven: `--ring` is `--primary`, the pair audit-brand-themes.py
		// pins at >= 3:1 against `--background` in both modes.
		expect(body).toContain('hsl(var(--ring))');
	});

	it('keeps the rule inside a base layer so every utility outranks it', () => {
		const baseLayerStarts = [...appCss.matchAll(/@layer base\s*\{/g)].map((m) => m.index ?? -1);
		expect(baseLayerStarts.length).toBeGreaterThan(0);
		const ruleIndex = appCss.indexOf(':where(:focus-visible)');
		// The rule must sit after some `@layer base {` opener.
		expect(baseLayerStarts.some((start) => start >= 0 && start < ruleIndex)).toBe(true);
	});
});

describe('no focus indicator is faded in by an unscoped transition (#780)', () => {
	/** A class string declares a focus indicator if it styles focus at all. */
	const DECLARES_FOCUS =
		/(focus|focus-visible|focus-within|peer-focus|peer-focus-visible|group-focus|group-focus-visible)(-[a-z-]+)?:(ring|outline|border|shadow)/;

	/**
	 * Pseudo-element transitions (`after:transition-all`) animate the pseudo,
	 * never the host's own outline or ring, so they are not offenders.
	 */
	const BARE_TRANSITION_ALL = /(^|[\s'"`])transition-all([\s'"`]|$)/;

	it('has no class string combining `transition-all` with focus styling', () => {
		const offenders: string[] = [];

		for (const file of walk(SRC)) {
			const text = readFileSync(file, 'utf-8');
			// Class strings are quoted literals; scan each one independently so a
			// `transition-all` in one attribute cannot alias a focus utility in
			// another.
			for (const match of text.matchAll(/(['"`])((?:[^'"`\\\n]|\\.)*)\1/g)) {
				const s = match[2];
				if (!BARE_TRANSITION_ALL.test(s)) continue;
				if (!DECLARES_FOCUS.test(s)) continue;
				const line = text.slice(0, match.index).split('\n').length;
				offenders.push(`${relative(process.cwd(), file)}:${line}`);
			}
		}

		expect(
			offenders,
			'`transition-all` animates outline-color and box-shadow, so it fades the focus ring in. ' +
				'Scope the transition (transition-colors / transition-transform / transition-shadow / an ' +
				'explicit property list) on any element that styles its own focus.'
		).toEqual([]);
	});
});
