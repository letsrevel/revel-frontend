/**
 * The destructive token SPLIT (issue #781), pinned as an executable contract.
 *
 * `--destructive` is a FILL (buttons, badges) whose label is
 * `--destructive-foreground`; a fill only owes WCAG 1.4.11's 3:1. Destructive
 * TEXT owes 4.5:1, and in dark mode the fill value cannot do both — borrowed as
 * text it measured 3.11:1 on `--background` and 2.85:1 on `--card`.
 *
 * The fix is `--destructive-text`, wired to the `text-destructive` utility via a
 * `textColor` override in tailwind.config.ts so all ~525 existing call sites are
 * corrected at once and future ones are safe by default. Two things therefore
 * have to stay true, and neither is visible to a type checker:
 *   1. the utility wiring — `text-destructive` on the text token, the fill
 *      utilities still on the fill token, `text-destructive-foreground` intact;
 *   2. the dark value actually clearing 4.5:1 on the surfaces it lands on.
 *
 * (1) is asserted against `resolveConfig()` rather than the config literal, so
 * it tests what Tailwind DOES with the override, not what we wrote. Mutation-
 * tested: deleting the `textColor` override fails this file.
 *
 * Note the boundary this does NOT cover: the remap is a Tailwind theme key, so
 * it reaches Tailwind utilities only. Raw CSS in a `<style>` block must name
 * `--destructive-text` itself (see create-org/+page.svelte), and
 * `decoration-/placeholder-/caret-/accent-destructive` still resolve to the fill.
 *
 * scripts/audit-brand-themes.py checks (2) as well, but it is a separate manual
 * gate; this keeps the regression inside `pnpm test`.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import resolveTailwindConfig from 'tailwindcss/resolveConfig';
import tailwindConfig from '../../../tailwind.config';

type ColorScale = { DEFAULT: string; foreground: string };

// The RESOLVED theme, not the config literal. "`extend.textColor` replaces
// `colors.destructive` for the text scale" is an assumption about Tailwind's
// merge semantics, and asserting the literal would only prove what we typed: if
// a future Tailwind merged instead of replaced, `text-destructive` would revert
// to the fill while a literal-based test stayed green.
const resolved = resolveTailwindConfig(tailwindConfig).theme as unknown as {
	textColor: Record<string, ColorScale>;
	backgroundColor: Record<string, ColorScale>;
	borderColor: Record<string, ColorScale>;
};

// Read the stylesheet off disk rather than importing it: `?raw` still routes
// through Vite's CSS pipeline, and the theme lives in plain text either way.
// (Vitest runs from the project root; `import.meta.url` is an http: URL under
// the jsdom environment, so a path relative to cwd is the portable choice.)
const appCss = readFileSync(resolve(process.cwd(), 'src/app.css'), 'utf8');

/** Slice out a rule body by brace-matching from its selector. */
function ruleBody(selector: string): string {
	const start = appCss.indexOf(selector);
	if (start === -1) throw new Error(`no \`${selector}\` rule in app.css`);
	const open = appCss.indexOf('{', start);
	let depth = 0;
	for (let i = open; i < appCss.length; i++) {
		if (appCss[i] === '{') depth++;
		else if (appCss[i] === '}' && --depth === 0) return appCss.slice(open + 1, i);
	}
	throw new Error(`unbalanced braces after \`${selector}\``);
}

const BLOCKS = { light: ruleBody(':root'), dark: ruleBody('.dark') };

/** Pull an `--x: H S% L%;` triple out of a `:root {}` / `.dark {}` block. */
function readToken(mode: 'light' | 'dark', token: string): [number, number, number] {
	// Dark inherits anything it does not restate (e.g. --destructive-text would
	// be a light-only token if the split were ever undone).
	const source = BLOCKS[mode];
	const pattern = new RegExp(`--${token}:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%\\s*;`);
	const decl = pattern.exec(source) ?? (mode === 'dark' ? pattern.exec(BLOCKS.light) : null);
	if (!decl) throw new Error(`--${token} not declared in ${mode} mode`);
	return [Number(decl[1]), Number(decl[2]), Number(decl[3])];
}

function hslToRgb([h, s, l]: [number, number, number]): [number, number, number] {
	const sat = s / 100;
	const lig = l / 100;
	const c = (1 - Math.abs(2 * lig - 1)) * sat;
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = lig - c / 2;
	const [r, g, b] =
		h < 60
			? [c, x, 0]
			: h < 120
				? [x, c, 0]
				: h < 180
					? [0, c, x]
					: h < 240
						? [0, x, c]
						: h < 300
							? [x, 0, c]
							: [c, 0, x];
	return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function luminance(rgb: [number, number, number]): number {
	const [r, g, b] = rgb.map((v) => {
		const c = v / 255;
		return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}

/** `bg-<token>/<alpha>` painted over an opaque surface. */
function composite(
	over: [number, number, number],
	alpha: number,
	base: [number, number, number]
): [number, number, number] {
	return [0, 1, 2].map((i) => alpha * over[i] + (1 - alpha) * base[i]) as [number, number, number];
}

describe('the destructive text/fill token split (#781)', () => {
	it('routes `text-destructive` to the text token and fill utilities to the fill token', () => {
		expect(resolved.textColor.destructive.DEFAULT).toContain('var(--destructive-text)');
		// `colors` still drives bg-/border-/ring-/divide-destructive.
		expect(resolved.backgroundColor.destructive.DEFAULT).toContain('var(--destructive)');
		expect(resolved.backgroundColor.destructive.DEFAULT).not.toContain('var(--destructive-text)');
		expect(resolved.borderColor.destructive.DEFAULT).toContain('var(--destructive)');
		expect(resolved.borderColor.destructive.DEFAULT).not.toContain('var(--destructive-text)');
	});

	it('keeps `text-destructive-foreground` pointing at the fill label', () => {
		// Asserts the INVARIANT, not the mechanism. Tailwind deep-merges the
		// override into `colors.destructive` (compile-verified), so this survives
		// whether or not tailwind.config.ts restates the key — which is exactly
		// why it is written against the resolved scale: it stays true under merge
		// OR replace semantics, and only fails if the pair itself is broken.
		expect(resolved.textColor.destructive.foreground).toContain('var(--destructive-foreground)');
	});

	it('leaves light mode byte-identical to the fill token', () => {
		expect(readToken('light', 'destructive-text')).toEqual(readToken('light', 'destructive'));
	});

	it('splits the token in dark mode, where the fill value fails as text', () => {
		const fill = hslToRgb(readToken('dark', 'destructive'));
		const background = hslToRgb(readToken('dark', 'background'));
		// The bug this token exists for — kept as a live assertion so a future
		// lightening of the fill makes this test tell us the split is redundant.
		expect(contrast(fill, background)).toBeLessThan(4.5);
		expect(readToken('dark', 'destructive-text')).not.toEqual(readToken('dark', 'destructive'));
	});

	it.each([
		['background', 4.5],
		['card', 4.5],
		['popover', 4.5],
		['muted', 4.5]
	])('clears AA text contrast on --%s in both modes', (surface, need) => {
		for (const mode of ['light', 'dark'] as const) {
			const ratio = contrast(
				hslToRgb(readToken(mode, 'destructive-text')),
				hslToRgb(readToken(mode, surface))
			);
			expect(ratio, `${mode}: destructive-text on --${surface}`).toBeGreaterThanOrEqual(need);
		}
	});

	it.each([0.1, 0.25])(
		'clears AA on its own bg-destructive/%s wash over the card',
		(alpha: number) => {
			for (const mode of ['light', 'dark'] as const) {
				const wash = composite(
					hslToRgb(readToken(mode, 'destructive')),
					alpha,
					hslToRgb(readToken(mode, 'card'))
				);
				const ratio = contrast(hslToRgb(readToken(mode, 'destructive-text')), wash);
				expect(
					ratio,
					`${mode}: destructive-text on destructive/${alpha} over card`
				).toBeGreaterThanOrEqual(4.5);
			}
		}
	);
});
