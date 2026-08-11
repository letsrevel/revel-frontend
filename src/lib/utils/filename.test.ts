import { describe, it, expect } from 'vitest';
import { toFilenameSlug } from './filename';

describe('toFilenameSlug', () => {
	it('lowercases and hyphenates', () => {
		expect(toFilenameSlug('My Event')).toBe('my-event');
	});

	it('collapses runs of punctuation into a single hyphen', () => {
		expect(toFilenameSlug('Acme  &  Co.')).toBe('acme-co');
	});

	// The bug this helper exists to stop: trailing punctuation used to survive as
	// a dangling hyphen, so "Acme Collective!" produced
	// "acme-collective--membership.pkpass".
	it('trims leading and trailing hyphens', () => {
		expect(toFilenameSlug('Acme Collective!')).toBe('acme-collective');
		expect(toFilenameSlug('!!!Loud!!!')).toBe('loud');
	});

	it('caps the length so a long name cannot blow up the filename', () => {
		expect(toFilenameSlug('a'.repeat(80))).toHaveLength(30);
	});

	// Truncation can land mid-separator; the result must still not end in a hyphen.
	it('never ends in a hyphen after truncation', () => {
		const slug = toFilenameSlug('aaaaaaaaaaaaaaaaaaaaaaaaaaaaa ffff');
		expect(slug.endsWith('-')).toBe(false);
	});

	it('falls back for a name with nothing usable in it', () => {
		expect(toFilenameSlug('!!!')).toBe('download');
		expect(toFilenameSlug('')).toBe('download');
	});

	it('takes a caller-supplied fallback', () => {
		expect(toFilenameSlug('', 'membership')).toBe('membership');
	});
});
