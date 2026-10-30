import { eventpublicdiscoveryListEvents } from '$lib/api';
import { getBackendUrl } from '$lib/config/api';
import type { RequestHandler } from './$types';
import { orgOrigin } from '$lib/utils/org-links';
import { serverLinkContext } from '$lib/server/tenant-canonical';
import { siteName, tenantIconUrl } from '$lib/seo/tenant';
import { log } from '$lib/server/logger';
import { escapeCdata } from '$lib/utils/xml';

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
export const GET: RequestHandler = async ({ fetch, url, locals }) => {
	const tenant = locals.tenant ?? null;
	// Tenant host (#1057): the feed is the org's own, on the tenant origin, and
	// says nothing about Revel (no Revel title, editor or webmaster address).
	const baseUrl = tenant
		? (orgOrigin(tenant, serverLinkContext(locals)) ?? url.origin)
		: url.origin;
	const channelTitle = tenant ? `${siteName(tenant)} - Upcoming Events` : 'Revel - Upcoming Events';
	const linkCtx = serverLinkContext(locals);
	const channelLink = tenant ? `${baseUrl}/` : `${baseUrl}/events`;
	const channelDescription = tenant
		? stripHtml(tenant.description) || `Upcoming events from ${tenant.name}.`
		: 'Discover community events on Revel - concerts, workshops, meetups, and more.';
	const tenantIcon = tenantIconUrl(tenant);
	// Each entry is one fully indented line of the channel header.
	const channelExtras = (
		tenant
			? tenantIcon
				? [
						'    <image>',
						`      <url>${escapeXml(tenantIcon)}</url>`,
						`      <title>${escapeXml(tenant.name)}</title>`,
						`      <link>${baseUrl}/</link>`,
						'    </image>'
					]
				: []
			: [
					'    <image>',
					`      <url>${baseUrl}/favicon-v2.png</url>`,
					'      <title>Revel</title>',
					`      <link>${baseUrl}</link>`,
					'    </image>',
					'    <generator>Revel Event Platform</generator>',
					'    <docs>https://www.rssboard.org/rss-specification</docs>',
					'    <managingEditor>contact@letsrevel.io (Revel Team)</managingEditor>',
					'    <webMaster>contact@letsrevel.io (Revel Team)</webMaster>'
				]
	)
		.map(
			(line) => `${line}
`
		)
		.join('');

	try {
		// Fetch upcoming public events
		const eventsResponse = await eventpublicdiscoveryListEvents({
			fetch,
			query: {
				page: 1,
				page_size: 50, // Latest 50 events for the feed
				include_past: false,
				...(tenant ? { organization: tenant.id } : {})
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
    <title>${escapeXml(channelTitle)}</title>
    <link>${channelLink}</link>
    <description>${escapeXml(channelDescription)}</description>
    <language>en</language>
    <lastBuildDate>${now}</lastBuildDate>
    <pubDate>${now}</pubDate>
    <ttl>60</ttl>
    <atom:link href="${baseUrl}/feed.xml" rel="self" type="application/rss+xml"/>
${channelExtras}    <category>Events</category>
    <category>Community</category>
${events
	.map((event) => {
		// An org with an active custom domain is canonical there; the platform URL 301s to it.
		const eventUrl = `${orgOrigin(event.organization, linkCtx) ?? baseUrl}/events/${event.organization.slug}/${event.slug}`;
		const description =
			stripHtml(event.description) || `Join ${event.name} organized by ${event.organization.name}`;
		const truncatedDescription =
			description.length > 500 ? description.slice(0, 497) + '...' : description;
		const imageUrl = event.cover_art || event.logo;
		const eventDate = new Date(event.start);
		const locationParts = [event.city?.name, event.city?.country].filter(Boolean);
		const location = locationParts.join(', ');
		/* eslint-disable no-restricted-syntax -- RSS server endpoint, no request locale; fixed en-US by design */
		const eventDateFormatted = event.start
			? eventDate.toLocaleDateString('en-US', {
					weekday: 'long',
					year: 'numeric',
					month: 'long',
					day: 'numeric'
				})
			: '';
		/* eslint-enable no-restricted-syntax */

		const cdataContent = escapeCdata(
			`${truncatedDescription}${location ? `\n\nLocation: ${location}` : ''}${eventDateFormatted ? `\nDate: ${eventDateFormatted}` : ''}`
		);

		return `    <item>
      <title>${escapeXml(event.name)}</title>
      <link>${escapeXml(eventUrl)}</link>
      <guid isPermaLink="true">${escapeXml(eventUrl)}</guid>
      <description><![CDATA[${cdataContent}]]></description>
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
		log.error('rss_feed_failed', { error });

		// Return empty feed on error
		const emptyFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(channelTitle)}</title>
    <link>${channelLink}</link>
    <description>${escapeXml(tenant ? channelDescription : 'Discover community events on Revel.')}</description>
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
