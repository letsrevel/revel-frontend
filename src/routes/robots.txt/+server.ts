import type { RequestHandler } from './$types';
import { orgOrigin } from '$lib/utils/org-links';
import { serverLinkContext } from '$lib/server/tenant-canonical';

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
 * AI-crawler policy: AI *search* agents (OAI-SearchBot, ChatGPT-User,
 * Claude-SearchBot, PerplexityBot) fall under the `*` group like any search
 * engine. AI *training* crawlers may read Revel's own pages (landing pages,
 * /llms.txt) but not organizer content: events, series, organizations and
 * embeds, and nothing at all on a tenant host. Cloudflare's "Block AI bots"
 * and managed robots.txt are switched off for the zone (2026-10-29); if they
 * are turned back on, Cloudflare prepends its own Disallow groups here.
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

// A tenant host (#1057) serves one org: the platform-only paths (org creation,
// org admin) are not part of it and must not be advertised in its robots.txt.
const PLATFORM_ONLY_RULES = new Set([
	'Disallow: /create-org',
	'Disallow: /org/*/admin',
	'Disallow: /org/*/admin/'
]);
const TENANT_DISALLOW_RULES = DISALLOW_RULES.split('\n')
	.filter((rule) => !PLATFORM_ONLY_RULES.has(rule))
	.join('\n');

// SEO-tool crawlers that hammer small sites; keep them restricted and slow.
const SLOW_BOTS = ['AhrefsBot', 'SemrushBot', 'MJ12bot'];

// AI training crawlers and opt-out tokens (Google-Extended and
// Applebot-Extended only control training; search crawling is unaffected).
const AI_TRAINING_BOTS = [
	'GPTBot',
	'ClaudeBot',
	'anthropic-ai',
	'CCBot',
	'Google-Extended',
	'Applebot-Extended',
	'meta-externalagent',
	'Amazonbot',
	'Bytespider',
	'cohere-ai',
	'cohere-training-data-crawler',
	'Diffbot'
];
const AI_TRAINING_AGENTS = AI_TRAINING_BOTS.map((bot) => `User-agent: ${bot}`).join('\n');

// Organizer content (events, series, org pages, embeds) stays out of training sets.
const ORGANIZER_CONTENT_RULES = `Disallow: /events
Disallow: /org/
Disallow: /organizations
Disallow: /embed/`;

export const GET: RequestHandler = async ({ url, locals }) => {
	const tenant = locals.tenant ?? null;
	if (tenant) {
		const tenantBase = orgOrigin(tenant, serverLinkContext(locals)) ?? url.origin;
		const slowGroups = SLOW_BOTS.map(
			(bot) => `User-agent: ${bot}
${TENANT_DISALLOW_RULES}
Crawl-delay: 10`
		).join('\n\n');
		const body = `User-agent: *
Allow: /
${TENANT_DISALLOW_RULES}

${slowGroups}

${AI_TRAINING_AGENTS}
Disallow: /

Sitemap: ${tenantBase}/sitemap.xml
`;
		return new Response(body, {
			headers: {
				'Content-Type': 'text/plain; charset=utf-8',
				'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400'
			}
		});
	}

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

# AI training crawlers: Revel's own pages yes, organizer content no.
${AI_TRAINING_AGENTS}
${ORGANIZER_CONTENT_RULES}
${DISALLOW_RULES}

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
