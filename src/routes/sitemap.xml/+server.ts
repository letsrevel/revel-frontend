import {
	eventListEvents,
	organizationListOrganizations,
	eventseriesListEventSeries
} from '$lib/api';
import { getBackendUrl } from '$lib/config/api';
import type { RequestHandler } from './$types';

/**
 * Calculate priority for an event based on how soon it is
 * Events happening sooner get higher priority
 */
function getEventPriority(startDate: string): string {
	const now = new Date();
	const eventDate = new Date(startDate);
	const daysUntil = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

	if (daysUntil <= 7) return '0.9'; // This week - highest priority
	if (daysUntil <= 30) return '0.8'; // This month
	if (daysUntil <= 90) return '0.7'; // Next 3 months
	return '0.6'; // Further out
}

/**
 * Format date for sitemap lastmod (YYYY-MM-DD)
 */
function formatLastmod(dateStr: string | null | undefined): string {
	if (!dateStr) return new Date().toISOString().split('T')[0];
	return new Date(dateStr).toISOString().split('T')[0];
}

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

/**
 * Generate image sitemap entry if image URL exists
 */
function generateImageEntry(
	imageUrl: string | null | undefined,
	title: string,
	caption?: string
): string {
	if (!imageUrl) return '';
	const fullUrl = getBackendUrl(imageUrl);
	return `
      <image:image>
        <image:loc>${escapeXml(fullUrl)}</image:loc>
        <image:title>${escapeXml(title)}</image:title>
        ${caption ? `<image:caption>${escapeXml(caption)}</image:caption>` : ''}
      </image:image>`;
}

/**
 * Generate sitemap.xml dynamically with all public content
 * Includes: events, organizations, event series, and images
 * https://www.sitemaps.org/protocol.html
 * https://developers.google.com/search/docs/crawling-indexing/sitemaps/image-sitemaps
 */
export const GET: RequestHandler = async ({ fetch, url }) => {
	const baseUrl = url.origin;

	try {
		// Fetch all data in parallel for better performance
		const [eventsResponse, orgsResponse, seriesResponse] = await Promise.all([
			// Fetch upcoming public events
			eventListEvents({
				fetch,
				query: {
					page: 1,
					page_size: 1000,
					include_past: false
				}
			}),
			// Fetch all public organizations
			organizationListOrganizations({
				fetch,
				query: {
					page: 1,
					page_size: 1000
				}
			}),
			// Fetch all public event series
			eventseriesListEventSeries({
				fetch,
				query: {
					page: 1,
					page_size: 500
				}
			})
		]);

		const events = eventsResponse.data?.results || [];
		const organizations = orgsResponse.data?.results || [];
		const eventSeries = seriesResponse.data?.results || [];

		// Build sitemap XML with image extension
		const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
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
    <priority>0.4</priority>
  </url>
  <url>
    <loc>${baseUrl}/register</loc>
    <changefreq>monthly</changefreq>
    <priority>0.4</priority>
  </url>
  <url>
    <loc>${baseUrl}/legal/privacy</loc>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>${baseUrl}/legal/terms</loc>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>

  <!-- SEO Landing Pages (English) -->
  <url>
    <loc>${baseUrl}/eventbrite-alternative</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/queer-event-management</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/kink-event-ticketing</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/self-hosted-event-platform</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/privacy-focused-events</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>

  <!-- SEO Landing Pages (German) -->
  <url>
    <loc>${baseUrl}/de/eventbrite-alternative</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>${baseUrl}/de/queer-event-management</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>${baseUrl}/de/kink-event-ticketing</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>${baseUrl}/de/self-hosted-event-platform</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>${baseUrl}/de/privacy-focused-events</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>

  <!-- SEO Landing Pages (Italian) -->
  <url>
    <loc>${baseUrl}/it/eventbrite-alternative</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>${baseUrl}/it/queer-event-management</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>${baseUrl}/it/kink-event-ticketing</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>${baseUrl}/it/self-hosted-event-platform</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>${baseUrl}/it/privacy-focused-events</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>

  <!-- Dynamic Event Pages (${events.length} events) -->
${events
	.map((event) => {
		const eventUrl = `${baseUrl}/events/${event.organization.slug}/${event.slug}`;
		const priority = getEventPriority(event.start);
		const imageEntry =
			generateImageEntry(event.cover_art, event.name, `Cover image for ${event.name}`) ||
			generateImageEntry(event.logo, event.name, `Logo for ${event.name}`);

		return `  <url>
    <loc>${escapeXml(eventUrl)}</loc>
    <lastmod>${formatLastmod(event.updated_at)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>${imageEntry}
  </url>`;
	})
	.join('\n')}

  <!-- Dynamic Organization Pages (${organizations.length} organizations) -->
${organizations
	.map((org) => {
		const orgUrl = `${baseUrl}/org/${org.slug}`;
		const imageEntry =
			generateImageEntry(org.logo, org.name, `Logo for ${org.name}`) ||
			generateImageEntry(org.cover_art, org.name, `Cover image for ${org.name}`);

		return `  <url>
    <loc>${escapeXml(orgUrl)}</loc>
    <lastmod>${formatLastmod(org.updated_at)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>${imageEntry}
  </url>`;
	})
	.join('\n')}

  <!-- Dynamic Event Series Pages (${eventSeries.length} series) -->
${eventSeries
	.map((series) => {
		const seriesUrl = `${baseUrl}/events/${series.organization.slug}/series/${series.slug}`;
		const imageEntry =
			generateImageEntry(series.cover_art, series.name, `Cover image for ${series.name}`) ||
			generateImageEntry(series.logo, series.name, `Logo for ${series.name}`);

		return `  <url>
    <loc>${escapeXml(seriesUrl)}</loc>
    <lastmod>${formatLastmod(series.updated_at)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>${imageEntry}
  </url>`;
	})
	.join('\n')}
</urlset>`;

		return new Response(sitemap, {
			headers: {
				'Content-Type': 'application/xml; charset=utf-8',
				'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400'
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
  <url>
    <loc>${baseUrl}/organizations</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>`;

		return new Response(fallbackSitemap, {
			headers: {
				'Content-Type': 'application/xml; charset=utf-8',
				'Cache-Control': 'public, max-age=600'
			}
		});
	}
};
