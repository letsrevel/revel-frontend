import type { RequestHandler } from './$types';

/**
 * Generate robots.txt dynamically
 * https://www.robotstxt.org/
 */
export const GET: RequestHandler = async ({ url }) => {
	const baseUrl = url.origin;

	const robotsTxt = `# Robots.txt for Revel
# Allow all search engines to crawl public pages

User-agent: *
Allow: /
Disallow: /api/
Disallow: /dashboard/
Disallow: /(auth)/
Disallow: /account/
Disallow: /org/*/admin/

# Sitemap location
Sitemap: ${baseUrl}/sitemap.xml

# Crawl delay (be nice to smaller bots)
Crawl-delay: 1
`;

	return new Response(robotsTxt, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
		}
	});
};
