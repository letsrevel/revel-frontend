// src/routes/sitemap-static.xml/server.test.ts
import { describe, it, expect } from 'vitest';
import { GET } from './+server';

async function fetchSitemap(): Promise<string> {
	const response = await GET({
		url: new URL('https://letsrevel.io/sitemap-static.xml')
	} as unknown as Parameters<typeof GET>[0]);
	return response.text();
}

function entry(body: string, loc: string): string {
	const block = body.split('<url>').find((b) => b.includes(`<loc>${loc}</loc>`));
	expect(block, `no <url> for ${loc}`).toBeDefined();
	return block as string;
}

describe('GET /sitemap-static.xml (#994)', () => {
	it('single-URL pages carry no hreflang alternates', async () => {
		const body = await fetchSitemap();
		for (const loc of ['https://letsrevel.io/', 'https://letsrevel.io/events']) {
			expect(entry(body, loc)).not.toContain('xhtml:link');
		}
	});

	it('landing pages keep all per-locale alternates plus x-default', async () => {
		const block = entry(await fetchSitemap(), 'https://letsrevel.io/de/eventbrite-alternative');
		expect(block.match(/<xhtml:link /g)).toHaveLength(7);
		expect(block).toContain('hreflang="pt" href="https://letsrevel.io/pt/eventbrite-alternative"');
		expect(block).toContain(
			'hreflang="x-default" href="https://letsrevel.io/eventbrite-alternative"'
		);
	});
});
