import { error } from '@sveltejs/kit';
import { organizationListOrganizations } from '$lib/api';
import { getBackendUrl } from '$lib/config/api';
import type { RequestHandler } from './$types';

const PAGE_SIZE = 200;

function escapeXml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

function alts(loc: string): string {
	return (
		['en', 'de', 'it', 'fr']
			.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${escapeXml(loc)}"/>`)
			.join('') + `<xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(loc)}"/>`
	);
}

function img(rel: string | null | undefined, title: string): string {
	if (!rel) return '';
	return `<image:image><image:loc>${escapeXml(getBackendUrl(rel))}</image:loc><image:title>${escapeXml(title)}</image:title></image:image>`;
}

export const GET: RequestHandler = async ({ params, fetch, url }) => {
	const page = parseInt(params.page, 10);
	if (!Number.isInteger(page) || page < 1) throw error(404, 'Invalid sitemap page');

	const baseUrl = url.origin;
	const resp = await organizationListOrganizations({
		fetch,
		query: { page, page_size: PAGE_SIZE }
	});
	const orgs = resp.data?.results ?? [];
	if (orgs.length === 0 && page > 1) throw error(404, 'No orgs on this page');

	const urls = orgs.map((o) => {
		const loc = `${baseUrl}/org/${o.slug}`;
		const lastmod = (o.updated_at ? new Date(o.updated_at) : new Date())
			.toISOString()
			.split('T')[0];
		return `<url>
  <loc>${escapeXml(loc)}</loc>
  ${alts(loc)}
  <lastmod>${lastmod}</lastmod>
  <changefreq>weekly</changefreq>
  <priority>0.7</priority>
  ${img(o.logo ?? o.cover_art, o.name)}
</url>`;
	});

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join('\n')}
</urlset>`;

	return new Response(xml, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400'
		}
	});
};
