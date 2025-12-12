import type { RequestHandler } from './$types';

/**
 * Generate robots.txt dynamically
 * https://www.robotstxt.org/
 * https://developers.google.com/search/docs/crawling-indexing/robots/intro
 */
export const GET: RequestHandler = async ({ url }) => {
	const baseUrl = url.origin;

	const robotsTxt = `# Robots.txt for Revel - Community Event Platform
# https://letsrevel.io
# Allow all search engines to crawl public pages

# Default rules for all bots
User-agent: *
Allow: /
Allow: /events
Allow: /events/
Allow: /organizations
Allow: /org/
Allow: /legal/

# Disallow private/authenticated areas
Disallow: /api/
Disallow: /dashboard
Disallow: /dashboard/
Disallow: /account
Disallow: /account/
Disallow: /create-org
Disallow: /org/*/admin
Disallow: /org/*/admin/
Disallow: /join/
Disallow: /verify
Disallow: /reset-password
Disallow: /confirm-action

# Disallow URL parameters that create duplicate content
Disallow: /*?viewMode=
Disallow: /*?page=
Disallow: /*&page=

# Google-specific settings
User-agent: Googlebot
Allow: /
Crawl-delay: 0

# Bing-specific settings
User-agent: Bingbot
Allow: /
Crawl-delay: 1

# GPTBot (OpenAI) - Allow for AI training on public event data
User-agent: GPTBot
Allow: /events
Allow: /org/
Disallow: /api/
Disallow: /dashboard
Disallow: /account

# CCBot (Common Crawl) - Allow for research purposes
User-agent: CCBot
Allow: /
Crawl-delay: 2

# Aggressive bots - slow them down
User-agent: AhrefsBot
Crawl-delay: 10

User-agent: SemrushBot
Crawl-delay: 10

User-agent: MJ12bot
Crawl-delay: 10

# Sitemap location
Sitemap: ${baseUrl}/sitemap.xml

# RSS/Atom Feed for events
# Note: This is informational - crawlers use <link rel="alternate"> in HTML
# Feed: ${baseUrl}/feed.xml
`;

	return new Response(robotsTxt, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800'
		}
	});
};
