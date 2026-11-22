import { describe, expect, it } from 'vitest';
import { decodeHtmlEntities, markdownToPlainText } from './plain-text';

describe('markdownToPlainText', () => {
	it('returns empty string for nullish input', () => {
		expect(markdownToPlainText(null)).toBe('');
		expect(markdownToPlainText(undefined)).toBe('');
		expect(markdownToPlainText('')).toBe('');
	});

	it('strips headings, emphasis and links', () => {
		const md = '## Welcome\n\nJoin **the best** _party_ at [our site](https://example.com/x)!';
		expect(markdownToPlainText(md)).toBe('Welcome Join the best party at our site!');
	});

	it('keeps image alt text and drops the url', () => {
		expect(markdownToPlainText('![Flyer](https://x.io/a.png) Doors at 8')).toBe('Flyer Doors at 8');
	});

	it('strips list markers, blockquotes and task boxes', () => {
		const md = '- one\n- two\n1. three\n> quoted\n- [x] done';
		expect(markdownToPlainText(md)).toBe('one two three quoted done');
	});

	it('strips code fences, inline code and horizontal rules', () => {
		const md = 'Run:\n```js\nconst a = 1;\n```\n---\nUse `npm i` now';
		expect(markdownToPlainText(md)).toBe('Run: const a = 1; Use npm i now');
	});

	it('strips table pipes and separator rows', () => {
		const md = '| Time | Act |\n| --- | --- |\n| 8pm | DJ A |';
		expect(markdownToPlainText(md)).toBe('Time Act 8pm DJ A');
	});

	it('unescapes backslash escapes', () => {
		expect(markdownToPlainText('snake\\_case and 5\\*3')).toBe('snake_case and 5*3');
	});

	it('strips html tags and decodes entities', () => {
		const md =
			'Rock &amp; Roll &lt;3 <b>night</b><br>&quot;Live&quot; &#39;set&#39; &#x2764; &#128512;';
		expect(markdownToPlainText(md)).toBe('Rock & Roll <3 night "Live" \'set\' ❤ \u{1F600}');
	});

	it('leaves unknown or malformed entities alone', () => {
		expect(markdownToPlainText('a &bogus; b &#99999999999;')).toBe('a &bogus; b &#99999999999;');
	});

	it('does not eat snake_case words or lone underscores', () => {
		expect(markdownToPlainText('use my_var_name here')).toBe('use my_var_name here');
	});

	it('truncates with an ellipsis', () => {
		expect(markdownToPlainText('**abcdefghij**', 5)).toBe('abcd…');
		expect(markdownToPlainText('short', 50)).toBe('short');
	});
});

describe('markdownToPlainText autolinks, escapes and list markers', () => {
	it('unwraps autolinks instead of removing them as tags', () => {
		expect(markdownToPlainText('Tickets at <https://example.com> now')).toBe(
			'Tickets at https://example.com now'
		);
		expect(markdownToPlainText('mail <me@x.com>')).toBe('mail me@x.com');
		expect(markdownToPlainText('call <mailto:me@x.com>')).toBe('call mailto:me@x.com');
		expect(markdownToPlainText('a <b>bold</b> b')).toBe('a bold b');
	});

	it('keeps escaped punctuation literal and out of emphasis processing', () => {
		expect(markdownToPlainText('\\*not italic\\*')).toBe('*not italic*');
		expect(markdownToPlainText('snake\\_case\\_name and \\# tag')).toBe(
			'snake_case_name and # tag'
		);
		expect(markdownToPlainText('\\1. no list')).toBe('\\1. no list');
		expect(markdownToPlainText('\\- not a list')).toBe('- not a list');
	});

	it('strips short ordered markers but keeps a year at line start', () => {
		expect(markdownToPlainText('1. Item')).toBe('Item');
		expect(markdownToPlainText('12) Item')).toBe('Item');
		expect(markdownToPlainText('1990. Best year')).toBe('1990. Best year');
	});

	it('exports the entity decoder', () => {
		expect(decodeHtmlEntities('a &amp; b &#x41;')).toBe('a & b A');
	});

	it('unwraps only real autolinks, not namespaced tags', () => {
		expect(markdownToPlainText('<st1:City>Vienna</st1:City>')).toBe('Vienna');
		expect(markdownToPlainText('<svg:rect/>x')).toBe('x');
		expect(markdownToPlainText('see <https://a.b/c> and <tel:+4312345> and <me@x.com>')).toBe(
			'see https://a.b/c and tel:+4312345 and me@x.com'
		);
	});

	it('keeps private-use characters in the input intact', () => {
		expect(markdownToPlainText('a\uE005b \\*lit\\*')).toBe('a\uE005b *lit*');
		expect(markdownToPlainText('\\*not italic\\* and *italic*')).toBe('*not italic* and italic');
	});
});
