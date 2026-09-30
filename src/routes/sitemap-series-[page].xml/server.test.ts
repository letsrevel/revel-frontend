// src/routes/sitemap-series-[page].xml/server.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('$lib/api', () => ({
	eventseriesListEventSeries: vi.fn(async () => ({
		data: {
			results: [
				{
					slug: 'weekly',
					name: 'Weekly',
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

describe('GET /sitemap-series-[page].xml (#994)', () => {
	it('entries are single-URL pages and carry no hreflang alternates', async () => {
		const response = await GET({
			params: { page: '1' },
			fetch,
			url: new URL('https://letsrevel.io/sitemap-series-1.xml')
		} as unknown as Parameters<typeof GET>[0]);
		const body = await response.text();
		expect(body).toContain('<loc>https://letsrevel.io/');
		expect(body).not.toContain('xhtml:link');
	});
});
