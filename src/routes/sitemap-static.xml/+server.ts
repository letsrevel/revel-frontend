import type { RequestHandler } from './$types';

const STATIC = [
	{ path: '/', changefreq: 'daily', priority: '1.0' },
	{ path: '/events', changefreq: 'hourly', priority: '0.9' },
	{ path: '/organizations', changefreq: 'daily', priority: '0.8' },
	{ path: '/login', changefreq: 'monthly', priority: '0.4' },
	{ path: '/register', changefreq: 'monthly', priority: '0.4' },
	{ path: '/legal/privacy', changefreq: 'monthly', priority: '0.3' },
	{ path: '/legal/terms', changefreq: 'monthly', priority: '0.3' }
];

const LANDING_SLUGS = [
	'eventbrite-alternative',
	'queer-event-management',
	'kink-event-ticketing',
	'self-hosted-event-platform',
	'privacy-focused-events',
	'community-first-event-platform'
];

const LANGS = ['en', 'de', 'it'] as const;
const PREFIX: Record<(typeof LANGS)[number], string> = { en: '', de: '/de', it: '/it' };

function escapeXml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

function sameUrlAlternates(loc: string): string {
	return (
		LANGS.map(
			(l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${escapeXml(loc)}"/>`
		).join('') + `<xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(loc)}"/>`
	);
}

function landingAlternates(origin: string, slug: string): string {
	return (
		LANGS.map(
			(l) =>
				`<xhtml:link rel="alternate" hreflang="${l}" href="${escapeXml(`${origin}${PREFIX[l]}/${slug}`)}"/>`
		).join('') +
		`<xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(`${origin}/${slug}`)}"/>`
	);
}

export const GET: RequestHandler = async ({ url }) => {
	const baseUrl = url.origin;
	const lines: string[] = [];

	for (const s of STATIC) {
		const loc = `${baseUrl}${s.path}`;
		lines.push(`<url>
  <loc>${escapeXml(loc)}</loc>
  ${sameUrlAlternates(loc)}
  <changefreq>${s.changefreq}</changefreq>
  <priority>${s.priority}</priority>
</url>`);
	}

	for (const slug of LANDING_SLUGS) {
		for (const l of LANGS) {
			const loc = `${baseUrl}${PREFIX[l]}/${slug}`;
			lines.push(`<url>
  <loc>${escapeXml(loc)}</loc>
  ${landingAlternates(baseUrl, slug)}
  <changefreq>weekly</changefreq>
  <priority>${l === 'en' ? '0.8' : '0.7'}</priority>
</url>`);
		}
	}

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${lines.join('\n')}
</urlset>`;

	return new Response(xml, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800'
		}
	});
};
