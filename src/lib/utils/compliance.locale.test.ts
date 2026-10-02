import { describe, it, expect, vi } from 'vitest';

// countryName follows the UI language; the runtime's locale is stubbed here so
// the other compliance tests keep running in English.
const { locale } = vi.hoisted(() => ({ locale: { current: 'pt' } }));
vi.mock('$lib/paraglide/runtime.js', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/paraglide/runtime.js')>()),
	getLocale: () => locale.current
}));

const { countryName } = await import('./compliance');

describe('countryName per UI language', () => {
	it('uses European Portuguese names for pt, not Brazilian ones', () => {
		locale.current = 'pt';
		expect(countryName('RO')).toBe('Roménia');
		expect(countryName('PL')).toBe('Polónia');
	});

	it('uses the UI language as is for the other locales', () => {
		locale.current = 'it';
		expect(countryName('DE')).toBe('Germania');
		locale.current = 'es';
		expect(countryName('PL')).toBe('Polonia');
	});
});
