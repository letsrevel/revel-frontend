import { describe, expect, it } from 'vitest';
import { buildBrandThemeCss, hexToHslTriplet, type BrandThemeInput } from './brand-theme';

describe('hexToHslTriplet', () => {
	it.each([
		['#000000', '0 0% 0%'],
		['#FFFFFF', '0 0% 100%'],
		['#FF0000', '0 100% 50%'],
		['#8C3CDD', '269.81 70.31% 55.1%'],
		['#ff0000', '0 100% 50%'],
		['  #FF0000  ', '0 100% 50%']
	])('converts %s', (hex, expected) => {
		expect(hexToHslTriplet(hex)).toBe(expected);
	});

	it.each(['#FFF', 'FF0000', '#GG0000', 'red', '#FF0000;}body{x:y', ''])('rejects %j', (input) => {
		expect(hexToHslTriplet(input)).toBeNull();
	});
});

const valid: BrandThemeInput = {
	light: { primary: '#8C3CDD', primary_foreground: '#FFFFFF' },
	dark: { primary: '#AB82DB', primary_foreground: '#000000' }
};

describe('buildBrandThemeCss', () => {
	it('returns null for null/undefined', () => {
		expect(buildBrandThemeCss(null)).toBeNull();
		expect(buildBrandThemeCss(undefined)).toBeNull();
	});

	it('emits primary tokens and no accent for a primary-only theme', () => {
		const css = buildBrandThemeCss(valid) ?? '';
		expect(css).toContain('--primary:');
		expect(css).toContain('--primary-foreground:');
		expect(css).toContain('--ring:');
		expect(css).not.toContain('--accent');
		expect(css.startsWith(':root:not(.dark){')).toBe(true);
		expect(css).toContain(':root.dark{');
	});

	it('emits accent tokens when an accent is set', () => {
		const css =
			buildBrandThemeCss({
				light: { ...valid.light, accent: '#F9B233', accent_foreground: '#000000' },
				dark: { ...valid.dark, accent: '#F9B233', accent_foreground: '#000000' }
			}) ?? '';
		expect(css).toContain('--accent:38.48 94.29% 58.82%');
		expect(css).toContain('--accent-foreground:0 0% 0%');
	});

	it('returns null if either mode has an invalid hex', () => {
		expect(buildBrandThemeCss({ ...valid, light: { ...valid.light, primary: 'nope' } })).toBeNull();
		expect(
			buildBrandThemeCss({ ...valid, dark: { ...valid.dark, primary_foreground: '#12' } })
		).toBeNull();
	});

	it('output contains only injection-safe characters', () => {
		const css = buildBrandThemeCss(valid) ?? '';
		expect(css).toMatch(/^[0-9A-Za-z%. :;\-(){}]+$/);
	});
});
