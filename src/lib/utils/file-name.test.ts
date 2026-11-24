import { describe, it, expect } from 'vitest';
import { fileNameFromUrl } from './file-name';

describe('fileNameFromUrl', () => {
	it('reads the name from an absolute URL, ignoring the query', () => {
		expect(fileNameFromUrl('https://cdn.example.com/a/flyer.pdf?x=1')).toBe('flyer.pdf');
	});

	it('strips the signature from a relative signed URL', () => {
		expect(fileNameFromUrl('/media/protected/flyer.pdf?exp=1700000000&sig=abc/def')).toBe(
			'flyer.pdf'
		);
	});

	it('strips a fragment', () => {
		expect(fileNameFromUrl('/media/flyer.pdf#page=2')).toBe('flyer.pdf');
	});

	it('decodes percent-encoded names', () => {
		expect(fileNameFromUrl('/media/Summer%20Menu%20%C3%A9.pdf?sig=1')).toBe('Summer Menu é.pdf');
	});

	it('keeps the raw name when the encoding is malformed', () => {
		expect(fileNameFromUrl('/media/100%.pdf')).toBe('100%.pdf');
	});

	it('returns an empty string when there is no name', () => {
		expect(fileNameFromUrl('/media/')).toBe('');
	});
});
