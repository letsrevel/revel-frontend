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

	it('returns null for empty or whitespace-only input', () => {
		expect(slugPreview('')).toBeNull();
		expect(slugPreview('   ')).toBeNull();
	});

	it('returns null when nothing sluggable survives normalization', () => {
		expect(slugPreview('???')).toBeNull();
		expect(slugPreview('東京')).toBeNull();
	});
});
