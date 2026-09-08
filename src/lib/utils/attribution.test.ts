import { describe, it, expect } from 'vitest';
import { sanitizeUtmValue, readAttributionFromUrl, withUtmParams } from './attribution';

describe('sanitizeUtmValue', () => {
	it.each([
		['newsletter', 'newsletter'],
		['  spring-2026  ', 'spring-2026'],
		['a.b:c_d-e', 'a.b:c_d-e'],
		['', null],
		[null, null],
		[undefined, null],
		['has spaces', null],
		['<script>', null],
		['emoji🎉', null]
	])('%j → %j', (raw, expected) => {
		expect(sanitizeUtmValue(raw)).toBe(expected);
	});

	it('caps at 100 chars BEFORE the charset test (long-but-valid keeps its head, like BE)', () => {
		expect(sanitizeUtmValue('a'.repeat(150))).toBe('a'.repeat(100));
	});
});

describe('readAttributionFromUrl', () => {
	it('returns null when no utm params are present', () => {
		expect(readAttributionFromUrl(new URL('https://x.test/events/a/b?page=2'))).toBeNull();
	});

	it('reads only the four utm keys and drops junk values', () => {
		const url = new URL(
			'https://x.test/e?utm_source=instagram&utm_campaign=bad value&utm_term=nope&other=1&utm_medium=social'
		);
		expect(readAttributionFromUrl(url)).toEqual({ utm_source: 'instagram', utm_medium: 'social' });
	});

	it('returns null when every value is junk', () => {
		expect(readAttributionFromUrl(new URL('https://x.test/?utm_source=a b'))).toBeNull();
	});
});

describe('withUtmParams', () => {
	const current = new URL('https://letsrevel.io/org/acme?utm_source=newsletter&utm_campaign=sept');

	it('appends surviving tags to a path href', () => {
		expect(withUtmParams('/events/acme/party', current)).toBe(
			'/events/acme/party?utm_source=newsletter&utm_campaign=sept'
		);
	});

	it('resolves ?-only hrefs against the current path', () => {
		expect(withUtmParams('?page=2', current)).toBe(
			'/org/acme?page=2&utm_source=newsletter&utm_campaign=sept'
		);
	});

	it('is a no-op when the current URL has no tags', () => {
		expect(withUtmParams('/events', new URL('https://letsrevel.io/'))).toBe('/events');
	});

	it('never overwrites a utm key already on the href', () => {
		expect(withUtmParams('/e?utm_source=embed', current)).toBe(
			'/e?utm_source=embed&utm_campaign=sept'
		);
	});

	it('drops junk values instead of carrying them', () => {
		const junky = new URL('https://letsrevel.io/?utm_source=ok&utm_medium=b a d');
		expect(withUtmParams('/e', junky)).toBe('/e?utm_source=ok');
	});
});
