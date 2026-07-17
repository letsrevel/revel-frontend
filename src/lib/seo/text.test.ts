// src/lib/seo/text.test.ts
import { describe, it, expect } from 'vitest';
import { stripHtml, stripMarkdown, stripMarkup, truncate } from './text';

describe('truncate', () => {
	it('returns short strings unchanged and ellipsizes overflow', () => {
		expect(truncate('short', 10)).toBe('short');
		expect(truncate('a'.repeat(20), 10)).toBe('a'.repeat(7) + '...');
		expect(truncate('', 10)).toBe('');
	});
});

describe('stripHtml', () => {
	it('strips tags and collapses whitespace', () => {
		expect(stripHtml('<p>Hello&nbsp;<b>world</b></p>\n<p>again</p>')).toBe('Hello world again');
		expect(stripHtml(null)).toBe('');
	});
});

describe('stripMarkup', () => {
	it('strips markdown headings, emphasis and lists (event descriptions are markdown)', () => {
		// Shape of real event descriptions that previously leaked "# … ## *…* **…**"
		// into meta descriptions.
		const md = [
			'# RIGGOROS - Love Rope - Köln',
			'## *Ein Fesseltreff für Einsteigys bis Alteingeseilte*',
			'Wir treffen uns **jeden Monat** zum Fesseln.',
			'- Anfänger willkommen',
			'- [Anmeldung](https://example.com)'
		].join('\n');
		expect(stripMarkup(md)).toBe(
			'RIGGOROS - Love Rope - Köln Ein Fesseltreff für Einsteigys bis Alteingeseilte ' +
				'Wir treffen uns jeden Monat zum Fesseln. Anfänger willkommen Anmeldung'
		);
	});

	it('also strips embedded HTML and handles empty input', () => {
		expect(stripMarkup('**bold** and <em>html</em>')).toBe('bold and html');
		expect(stripMarkup(null)).toBe('');
		expect(stripMarkup(undefined)).toBe('');
	});
});

describe('stripMarkdown', () => {
	it('needs line structure — headings are only stripped at line starts', () => {
		expect(stripMarkdown('# Title\nBody')).toBe('Title Body');
	});
});
