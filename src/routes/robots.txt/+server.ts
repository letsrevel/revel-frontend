import type { RequestHandler } from './$types';

/**
 * Generate robots.txt dynamically
 * https://www.robotstxt.org/
 * https://developers.google.com/search/docs/crawling-indexing/robots/intro
 *
 * IMPORTANT: a bot-specific `User-agent` group REPLACES the `*` group for that
 * bot — it does not extend it. Any per-bot group must therefore repeat the
 * private-area disallows, or the bot is silently exempted from all of them
 * (this bug previously let Googlebot/Bingbot crawl /dashboard, /account, …).
 *
 * AI-crawler policy (search yes, training no): in production Cloudflare
 * prepends a managed section that blocks AI-training crawlers (GPTBot,
 * ClaudeBot, CCBot, Google-Extended, Bytespider, …) and declares
 * `Content-Signal: search=yes, ai-train=no`. AI *search* crawlers
 * (OAI-SearchBot, PerplexityBot) are covered by the `*` group and stay
 * allowed. Do not add Allow groups for training bots here — they would
 * contradict the managed block.
 */

// Private/authenticated areas and duplicate-content params, shared by every
// user-agent group (see the group-replacement note above).
const DISALLOW_RULES = `Disallow: /api/
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
Disallow: /*?viewMode=
Disallow: /*?page=
Disallow: /*&page=`;

// SEO-tool crawlers that hammer small sites; keep them restricted and slow.
const SLOW_BOTS = ['AhrefsBot', 'SemrushBot', 'MJ12bot'];

export const GET: RequestHandler = async ({ url }) => {
	const baseUrl = url.origin;

	const slowBotGroups = SLOW_BOTS.map(
		(bot) => `User-agent: ${bot}
${DISALLOW_RULES}
Crawl-delay: 10`
	).join('\n\n');

	const robotsTxt = `# Robots.txt for Revel - Community Event Platform
# https://letsrevel.io
# Search engines are welcome on all public pages.

User-agent: *
Allow: /
${DISALLOW_RULES}

${slowBotGroups}

# Sitemap location
Sitemap: ${baseUrl}/sitemap.xml
# Sub-sitemaps (also discoverable via the index above)
Sitemap: ${baseUrl}/sitemap-static.xml
Sitemap: ${baseUrl}/sitemap-events-1.xml
Sitemap: ${baseUrl}/sitemap-orgs-1.xml
Sitemap: ${baseUrl}/sitemap-series-1.xml
`;

	return new Response(robotsTxt, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800'
		}
	});
};
