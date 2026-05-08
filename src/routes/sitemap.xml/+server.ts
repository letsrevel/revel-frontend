import {
	eventpublicdiscoveryListEvents,
	organizationListOrganizations,
	eventseriesListEventSeries
} from '$lib/api';
import type { RequestHandler } from './$types';

const PAGE_SIZE = 5000;

function pages(total: number): number {
	return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

export const GET: RequestHandler = async ({ fetch, url }) => {
	const baseUrl = url.origin;
	const lastmod = new Date().toISOString().split('T')[0];

	let eventCount = 0;
	let orgCount = 0;
	let seriesCount = 0;
	try {
		const [eventsResp, orgsResp, seriesResp] = await Promise.all([
			eventpublicdiscoveryListEvents({
				fetch,
				query: { page: 1, page_size: 1, include_past: false }
			}),
			organizationListOrganizations({ fetch, query: { page: 1, page_size: 1 } }),
			eventseriesListEventSeries({ fetch, query: { page: 1, page_size: 1 } })
		]);
		eventCount = eventsResp.data?.count ?? 0;
		orgCount = orgsResp.data?.count ?? 0;
		seriesCount = seriesResp.data?.count ?? 0;
	} catch (err) {
		console.error('[sitemap] index count failed:', err);
	}

	const entries: string[] = [];
	entries.push(
		`<sitemap><loc>${baseUrl}/sitemap-static.xml</loc><lastmod>${lastmod}</lastmod></sitemap>`
	);
	for (let i = 1; i <= pages(eventCount); i++) {
		entries.push(
			`<sitemap><loc>${baseUrl}/sitemap-events-${i}.xml</loc><lastmod>${lastmod}</lastmod></sitemap>`
		);
	}
	for (let i = 1; i <= pages(orgCount); i++) {
		entries.push(
			`<sitemap><loc>${baseUrl}/sitemap-orgs-${i}.xml</loc><lastmod>${lastmod}</lastmod></sitemap>`
		);
	}
	for (let i = 1; i <= pages(seriesCount); i++) {
		entries.push(
			`<sitemap><loc>${baseUrl}/sitemap-series-${i}.xml</loc><lastmod>${lastmod}</lastmod></sitemap>`
		);
	}

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</sitemapindex>`;

	return new Response(xml, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400'
		}
	});
};
