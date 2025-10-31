import { eventListEvents, organizationListOrganizations } from '$lib/api';
import type { RequestHandler } from './$types';

/**
 * Generate sitemap.xml dynamically with all public events and organizations
 * https://www.sitemaps.org/protocol.html
 */
export const GET: RequestHandler = async ({ fetch, url }) => {
	const baseUrl = url.origin;

	try {
		// Fetch all public events (paginated - get first 1000)
		const eventsResponse = await eventListEvents({
			fetch,
			query: {
				page: 1,
				page_size: 1000,
				include_past: false // Only upcoming events in sitemap
			}
		});

		const events = eventsResponse.data?.results || [];

		// Fetch all public organizations (paginated - get first 1000)
		const orgsResponse = await organizationListOrganizations({
			fetch,
			query: {
				page: 1,
				page_size: 1000
			}
		});

		const organizations = orgsResponse.data?.results || [];

		// Build sitemap XML
		const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Static Pages -->
  <url>
    <loc>${baseUrl}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/events</loc>
    <changefreq>hourly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${baseUrl}/organizations</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/login</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>${baseUrl}/register</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>

  <!-- Dynamic Event Pages -->
${events
	.map(
		(event) => `  <url>
    <loc>${baseUrl}/events/${event.organization.slug}/${event.slug}</loc>
    <lastmod>${event.updated_at || new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`
	)
	.join('\n')}

  <!-- Dynamic Organization Pages -->
${organizations
	.map(
		(org) => `  <url>
    <loc>${baseUrl}/org/${org.slug}</loc>
    <lastmod>${org.updated_at || new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`
	)
	.join('\n')}
</urlset>`;

		return new Response(sitemap, {
			headers: {
				'Content-Type': 'application/xml; charset=utf-8',
				'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
			}
		});
	} catch (error) {
		console.error('Error generating sitemap:', error);

		// Return basic sitemap on error
		const fallbackSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/events</loc>
    <changefreq>hourly</changefreq>
    <priority>0.9</priority>
  </url>
</urlset>`;

		return new Response(fallbackSitemap, {
			headers: {
				'Content-Type': 'application/xml; charset=utf-8',
				'Cache-Control': 'public, max-age=600' // Cache for 10 minutes on error
			}
		});
	}
};
