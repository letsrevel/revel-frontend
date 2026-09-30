// src/routes/sitemap-events-[page].xml/server.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('$lib/api', () => ({
	eventpublicdiscoveryListEvents: vi.fn(async () => ({
		data: {
			results: [
				{
					slug: 'my-event',
					name: 'My Event',
					start: '2026-12-01T18:00:00Z',
					updated_at: null,
					cover_art: null,
					logo: null,
					organization: { slug: 'acme' }
				}
			]
		}
	}))
}));

import { GET } from './+server';

describe('GET /sitemap-events-[page].xml (#994)', () => {
	it('entries are single-URL pages and carry no hreflang alternates', async () => {
		const response = await GET({
			params: { page: '1' },
			fetch,
			url: new URL('https://letsrevel.io/sitemap-events-1.xml')
		} as unknown as Parameters<typeof GET>[0]);
		const body = await response.text();
		expect(body).toContain('<loc>https://letsrevel.io/');
		expect(body).not.toContain('xhtml:link');
	});
});
