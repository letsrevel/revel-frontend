// RSS CDATA hardening: organizer text must never close the CDATA section.
import { describe, it, expect, vi } from 'vitest';

const mockEnv = vi.hoisted(() => ({ env: {} as Record<string, string | undefined> }));
vi.mock('$env/dynamic/private', () => mockEnv);

const listEvents = vi.fn();
vi.mock('$lib/api', () => ({
	eventpublicdiscoveryListEvents: (...a: unknown[]) => listEvents(...a)
}));

import { GET } from './+server';
import { escapeCdata, stripXmlControlChars, decodeBasicEntities } from '$lib/utils/xml';

const evil = ']]><item>x</item>';

const call = () =>
	(GET as unknown as (e: never) => Promise<Response>)({
		fetch,
		url: new URL('https://letsrevel.io/feed.xml'),
		locals: { tenant: null }
	} as never);

/** Removes every CDATA section, leaving only the XML that a parser would see as markup. */
const stripCdata = (xml: string) => xml.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '');

describe('escapeCdata', () => {
	it('splits every ]]> so the section cannot close early', () => {
		expect(escapeCdata('a]]>b]]>c')).toBe('a]]]]><![CDATA[>b]]]]><![CDATA[>c');
		expect(escapeCdata('plain')).toBe('plain');
	});
});

describe('feed.xml CDATA', () => {
	const event = (over: Record<string, unknown>) => ({
		slug: 'p',
		name: 'Safe name',
		start: '2099-01-01T18:00:00Z',
		created_at: '2026-01-01T00:00:00Z',
		cover_art: null,
		logo: null,
		description: '',
		city: null,
		organization: { slug: 'acme', name: 'Acme' },
		...over
	});
	// The route formats the date in the process timezone; derive the expected
	// text the same way so the assertions hold under any TZ.
	/* eslint-disable no-restricted-syntax -- mirrors the route's fixed en-US RSS date */
	const DATE = new Date('2099-01-01T18:00:00Z').toLocaleDateString('en-US', {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	});
	/* eslint-enable no-restricted-syntax */
	/** Content of the first <description> inside an <item> (CDATA wrapper removed). */
	const itemDescription = async (over: Record<string, unknown>) => {
		listEvents.mockResolvedValue({ data: { count: 1, results: [event(over)] } });
		const body = await (await call()).text();
		const item = body.slice(body.indexOf('<item>'));
		const m = item.match(/<description>([\s\S]*?)<\/description>/);
		if (!m) throw new Error('no <description> found');
		return m[1];
	};

	it('keeps a ]]> in the description inside the CDATA', async () => {
		const desc = await itemDescription({ description: 'a ]]> b' });
		expect(desc).toBe(`<![CDATA[a ]]&gt; b\nDate: ${DATE}]]>`);
		listEvents.mockResolvedValue({
			data: { count: 1, results: [event({ name: evil, description: '' })] }
		});
		const body = await (await call()).text();
		expect(stripCdata(body).match(/<item>/g)).toHaveLength(1);
	});

	it('HTML-escapes the name fallback and strips illegal control chars', async () => {
		const desc = await itemDescription({
			name: '<img src=x onerror=alert(1)>\u0001\u000b',
			organization: { slug: 'acme', name: 'Ac\u0000me' }
		});
		expect(desc).toBe(
			`<![CDATA[Join &lt;img src=x onerror=alert(1)&gt; organized by Acme\nDate: ${DATE}]]>`
		);
	});

	it('escapes an unclosed tag in the description payload', async () => {
		const desc = await itemDescription({ description: 'hi <img src=x onerror=alert(1)//' });
		expect(desc).toBe(`<![CDATA[hi &lt;img src=x onerror=alert(1)//\nDate: ${DATE}]]>`);
	});

	it('does not double-escape entities already in the description', async () => {
		const desc = await itemDescription({ description: 'Fish &amp; Chips &lt;3 &amp;lt;' });
		expect(desc).toBe(`<![CDATA[Fish &amp; Chips &lt;3 &amp;lt;\nDate: ${DATE}]]>`);
	});
});

describe('decodeBasicEntities', () => {
	it('decodes named and numeric entities, &amp; last', () => {
		expect(
			decodeBasicEntities('&lt;b&gt; &quot;x&quot; &#39;y&#39; &apos;z&apos; &#65;&#x42;')
		).toBe("<b> \"x\" 'y' 'z' AB");
		expect(decodeBasicEntities('&amp;lt;')).toBe('&lt;');
	});
});

describe('stripXmlControlChars', () => {
	it('removes XML 1.0-illegal characters but keeps tab, LF and CR', () => {
		expect(stripXmlControlChars('a\u0000b\u0008c\u000bd\u000ce\u001ff\ufffeg\uffffh')).toBe(
			'abcdefgh'
		);
		expect(stripXmlControlChars('a\tb\nc\rd')).toBe('a\tb\nc\rd');
	});
});
