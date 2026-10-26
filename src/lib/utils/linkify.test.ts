import { describe, expect, it } from 'vitest';
import { linkify } from './linkify';

describe('linkify', () => {
	it('returns a single text segment when there is no URL', () => {
		expect(linkify('Scheduled maintenance tonight')).toEqual([
			{ type: 'text', value: 'Scheduled maintenance tonight' }
		]);
	});

	it('splits a trailing URL out of the text', () => {
		expect(linkify('leave us a review at https://omr.com/en/reviews/new/product/revel')).toEqual([
			{ type: 'text', value: 'leave us a review at ' },
			{ type: 'link', value: 'https://omr.com/en/reviews/new/product/revel' }
		]);
	});

	it('handles several URLs and keeps the text between them', () => {
		expect(linkify('a http://x.io b https://y.io/p?q=1#h c')).toEqual([
			{ type: 'text', value: 'a ' },
			{ type: 'link', value: 'http://x.io' },
			{ type: 'text', value: ' b ' },
			{ type: 'link', value: 'https://y.io/p?q=1#h' },
			{ type: 'text', value: ' c' }
		]);
	});

	it('leaves trailing punctuation and an unbalanced closing bracket out of the link', () => {
		expect(linkify('See https://x.io/page. Or (https://y.io)!')).toEqual([
			{ type: 'text', value: 'See ' },
			{ type: 'link', value: 'https://x.io/page' },
			{ type: 'text', value: '. Or (' },
			{ type: 'link', value: 'https://y.io' },
			{ type: 'text', value: ')!' }
		]);
	});

	it('keeps balanced brackets that belong to the URL', () => {
		expect(linkify('https://en.wikipedia.org/wiki/Foo_(bar)')).toEqual([
			{ type: 'link', value: 'https://en.wikipedia.org/wiki/Foo_(bar)' }
		]);
	});

	it.each([
		['[https://x.io/docs]', '[', ']'],
		['{https://x.io/docs}', '{', '}'],
		['see https://x.io/docs].', 'see ', '].']
	])('leaves an unmatched closing bracket out of the link in %s', (input, before, after) => {
		expect(linkify(input)).toEqual([
			{ type: 'text', value: before },
			{ type: 'link', value: 'https://x.io/docs' },
			{ type: 'text', value: after }
		]);
	});

	it('keeps balanced square brackets, e.g. an IPv6 host', () => {
		expect(linkify('http://[::1]:8000/path')).toEqual([
			{ type: 'link', value: 'http://[::1]:8000/path' }
		]);
	});

	it('does not link non-http schemes', () => {
		expect(linkify('javascript:alert(1) and ftp://x.io')).toEqual([
			{ type: 'text', value: 'javascript:alert(1) and ftp://x.io' }
		]);
	});

	it('ignores a bare scheme with no host', () => {
		expect(linkify('just https:// here')).toEqual([{ type: 'text', value: 'just https:// here' }]);
	});
});
