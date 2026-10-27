import { describe, expect, it } from 'vitest';
import { slugPreview } from './slug-preview';

describe('slugPreview', () => {
	it('strips diacritics like Django slugify', () => {
		expect(slugPreview('Münchner Club')).toBe('munchner-club');
		expect(slugPreview('Café')).toBe('cafe');
	});

	it('collapses punctuation and trims dashes', () => {
		expect(slugPreview('  Acme & Co.  ')).toBe('acme-co');
	});

	it('falls back for empty or unsluggable input', () => {
		expect(slugPreview('')).toBe('your-org');
		expect(slugPreview('   ')).toBe('your-org');
		expect(slugPreview('???')).toBe('your-org');
	});
});
