// RSS CDATA hardening: organizer text must never close the CDATA section.
import { describe, it, expect, vi } from 'vitest';

const mockEnv = vi.hoisted(() => ({ env: {} as Record<string, string | undefined> }));
vi.mock('$env/dynamic/private', () => mockEnv);

const listEvents = vi.fn();
vi.mock('$lib/api', () => ({
	eventpublicdiscoveryListEvents: (...a: unknown[]) => listEvents(...a)
}));

import { GET } from './+server';
import { escapeCdata, stripXmlControlChars } from '$lib/utils/xml';

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
	it('keeps a ]]> in the event name inside the description CDATA', async () => {
		listEvents.mockResolvedValue({
			data: {
				count: 1,
				results: [
					{
						slug: 'p',
						name: evil,
						start: '2099-01-01T18:00:00Z',
						created_at: '2026-01-01T00:00:00Z',
						cover_art: null,
						logo: null,
						description: '',
						city: { name: evil, country: 'IT' },
						organization: { slug: 'acme', name: 'Acme' }
					}
				]
			}
		});
		const body = await (await call()).text();
		// Outside CDATA no raw injected element survives (the title is entity-escaped).
		expect(stripCdata(body)).not.toContain('<item>x</item>');
		expect(stripCdata(body).match(/<item>/g)).toHaveLength(1);
	});

	it('HTML-escapes the description text and strips illegal control chars', async () => {
		listEvents.mockResolvedValue({
			data: {
				count: 1,
				results: [
					{
						slug: 'p',
						name: '<img src=x onerror=alert(1)>\u0001\u000b',
						start: '2099-01-01T18:00:00Z',
						created_at: '2026-01-01T00:00:00Z',
						cover_art: null,
						logo: null,
						description: '',
						city: null,
						organization: { slug: 'acme', name: 'Ac\u0000me' }
					}
				]
			}
		});
		const body = await (await call()).text();
		expect(body).toContain('&lt;img src=x onerror=alert(1)&gt;');
		// eslint-disable-next-line no-control-regex
		expect(body).not.toMatch(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/);
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
