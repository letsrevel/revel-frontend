import { eventpublicdiscoveryListEvents } from '$lib/api';
import { getBackendUrl } from '$lib/config/api';
import type { RequestHandler } from './$types';

/**
 * Escape XML special characters
 */
function escapeXml(str: string | null | undefined): string {
	if (!str) return '';
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

/**
 * Strip HTML tags for plain text description
 */
function stripHtml(html: string | null | undefined): string {
	if (!html) return '';
	return html
		.replace(/<[^>]*>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Format date as RFC 822 (required for RSS)
 */
function formatRfc822Date(dateStr: string): string {
	return new Date(dateStr).toUTCString();
}

/**
 * Generate RSS 2.0 feed for upcoming events
 * https://www.rssboard.org/rss-specification
 *
 * This feed enables:
 * - RSS readers to subscribe to new events
 * - Social media aggregators to display events
 * - Third-party calendar integrations
 * - Google News (if applicable)
 */
export const GET: RequestHandler = async ({ fetch, url }) => {
	const baseUrl = url.origin;

	try {
		// Fetch upcoming public events
		const eventsResponse = await eventpublicdiscoveryListEvents({
			fetch,
			query: {
				page: 1,
				page_size: 50, // Latest 50 events for the feed
				include_past: false
			}
		});

		const events = eventsResponse.data?.results || [];
		const now = new Date().toUTCString();

		// Build RSS 2.0 feed
		const rssFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:media="http://search.yahoo.com/mrss/"
     xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Revel - Upcoming Events</title>
    <link>${baseUrl}/events</link>
    <description>Discover community events on Revel - concerts, workshops, meetups, and more.</description>
    <language>en</language>
    <lastBuildDate>${now}</lastBuildDate>
    <pubDate>${now}</pubDate>
    <ttl>60</ttl>
    <atom:link href="${baseUrl}/feed.xml" rel="self" type="application/rss+xml"/>
    <image>
      <url>${baseUrl}/favicon.png</url>
      <title>Revel</title>
      <link>${baseUrl}</link>
    </image>
    <generator>Revel Event Platform</generator>
    <docs>https://www.rssboard.org/rss-specification</docs>
    <managingEditor>contact@letsrevel.io (Revel Team)</managingEditor>
    <webMaster>contact@letsrevel.io (Revel Team)</webMaster>
    <category>Events</category>
    <category>Community</category>
${events
	.map((event) => {
		const eventUrl = `${baseUrl}/events/${event.organization.slug}/${event.slug}`;
		const description =
			stripHtml(event.description) || `Join ${event.name} organized by ${event.organization.name}`;
		const truncatedDescription =
			description.length > 500 ? description.slice(0, 497) + '...' : description;
		const imageUrl = event.cover_art || event.logo;
		const eventDate = new Date(event.start);
		const locationParts = [event.city?.name, event.city?.country].filter(Boolean);
		const location = locationParts.join(', ');

		return `    <item>
      <title>${escapeXml(event.name)}</title>
      <link>${escapeXml(eventUrl)}</link>
      <guid isPermaLink="true">${escapeXml(eventUrl)}</guid>
      <description><![CDATA[${truncatedDescription}${location ? `\n\nLocation: ${location}` : ''}${event.start ? `\nDate: ${eventDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}` : ''}]]></description>
      <pubDate>${formatRfc822Date(event.created_at || event.start)}</pubDate>
      <dc:creator>${escapeXml(event.organization.name)}</dc:creator>
      <category>${escapeXml(event.organization.name)}</category>${
				event.event_type
					? `
      <category>${escapeXml(event.event_type)}</category>`
					: ''
			}${
				imageUrl
					? `
      <media:content url="${escapeXml(getBackendUrl(imageUrl))}" medium="image"/>
      <media:thumbnail url="${escapeXml(getBackendUrl(imageUrl))}"/>`
					: ''
			}
    </item>`;
	})
	.join('\n')}
  </channel>
</rss>`;

		return new Response(rssFeed, {
			headers: {
				'Content-Type': 'application/rss+xml; charset=utf-8',
				'Cache-Control': 'public, max-age=1800, stale-while-revalidate=3600'
			}
		});
	} catch (error) {
		console.error('Error generating RSS feed:', error);

		// Return empty feed on error
		const emptyFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Revel - Upcoming Events</title>
    <link>${baseUrl}/events</link>
    <description>Discover community events on Revel.</description>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${baseUrl}/feed.xml" rel="self" type="application/rss+xml"/>
  </channel>
</rss>`;

		return new Response(emptyFeed, {
			headers: {
				'Content-Type': 'application/rss+xml; charset=utf-8',
				'Cache-Control': 'public, max-age=300'
			}
		});
	}
};
