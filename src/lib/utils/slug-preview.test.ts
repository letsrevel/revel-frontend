import { describe, expect, it } from 'vitest';
import { slugPreview } from './slug-preview';

const FALLBACK = 'your-org';

describe('slugPreview', () => {
	it('strips diacritics like Django slugify', () => {
		expect(slugPreview('Münchner Club', FALLBACK)).toBe('munchner-club');
		expect(slugPreview('Café', FALLBACK)).toBe('cafe');
	});

	it('collapses punctuation and trims dashes', () => {
		expect(slugPreview('  Acme & Co.  ', FALLBACK)).toBe('acme-co');
	});

	it('returns the caller-supplied fallback for empty or unsluggable input', () => {
		expect(slugPreview('', FALLBACK)).toBe(FALLBACK);
		expect(slugPreview('   ', FALLBACK)).toBe(FALLBACK);
		expect(slugPreview('???', FALLBACK)).toBe(FALLBACK);
		expect(slugPreview('', 'deine-organisation')).toBe('deine-organisation');
	});
});
