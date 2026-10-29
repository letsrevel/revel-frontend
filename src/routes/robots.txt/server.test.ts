// src/routes/robots.txt/server.test.ts
import { describe, it, expect } from 'vitest';
import { GET } from './+server';

async function fetchRobots(tenant: unknown = null): Promise<string> {
	const response = await GET({
		url: new URL('https://letsrevel.io/robots.txt'),
		locals: { tenant }
	} as unknown as Parameters<typeof GET>[0]);
	return response.text();
}

const AI_TRAINING_AGENTS = [
	'GPTBot',
	'ClaudeBot',
	'CCBot',
	'Google-Extended',
	'Applebot-Extended',
	'meta-externalagent'
];

// A user-agent group's rules apply INSTEAD of the `*` group's, not in addition
// to them — so every group must carry the private-area disallows itself.
function groupFor(body: string, agent: string): string | undefined {
	return body.split(/\n\n+/).find((block) => block.includes(`User-agent: ${agent}`));
}

describe('GET /robots.txt', () => {
	it('serves plain text with the sitemap index and all sub-sitemaps', async () => {
		const body = await fetchRobots();
		expect(body).toContain('Sitemap: https://letsrevel.io/sitemap.xml');
		for (const sub of ['static', 'events-1', 'orgs-1', 'series-1']) {
			expect(body).toContain(`Sitemap: https://letsrevel.io/sitemap-${sub}.xml`);
		}
	});

	it('disallows private areas and duplicate-content params for all bots', async () => {
		const star = groupFor(await fetchRobots(), '*');
		expect(star).toBeDefined();
		for (const path of ['/dashboard', '/account', '/api/', '/org/*/admin', '/*?page=']) {
			expect(star).toContain(`Disallow: ${path}`);
		}
	});

	it('has no per-bot Allow groups that would exempt search bots from the disallows', async () => {
		const body = await fetchRobots();
		// Googlebot/Bingbot groups with a bare `Allow: /` previously replaced the
		// `*` group entirely, exempting them from every Disallow.
		for (const agent of ['Googlebot', 'Bingbot']) {
			expect(groupFor(body, agent)).toBeUndefined();
		}
		for (const agent of AI_TRAINING_AGENTS) {
			expect(groupFor(body, agent)).not.toMatch(/^Allow:/m);
		}
	});

	it('keeps SEO-tool crawlers slowed down without exempting them from disallows', async () => {
		const body = await fetchRobots();
		for (const agent of ['AhrefsBot', 'SemrushBot', 'MJ12bot']) {
			const group = groupFor(body, agent);
			expect(group).toBeDefined();
			expect(group).toContain('Crawl-delay: 10');
			expect(group).toContain('Disallow: /dashboard');
		}
	});

	it('keeps AI training crawlers off organizer content but not marketing pages', async () => {
		const body = await fetchRobots();
		for (const agent of AI_TRAINING_AGENTS) {
			const group = groupFor(body, agent);
			expect(group).toBeDefined();
			for (const path of ['/events', '/org/', '/organizations', '/embed/', '/dashboard']) {
				expect(group).toContain(`Disallow: ${path}\n`);
			}
			expect(group).not.toMatch(/^Disallow: \/$/m);
		}
	});

	it('leaves organizer content open to search engines and AI search agents', async () => {
		const body = await fetchRobots();
		expect(groupFor(body, '*')).not.toContain('Disallow: /events');
		for (const agent of ['OAI-SearchBot', 'ChatGPT-User', 'Claude-SearchBot', 'PerplexityBot']) {
			expect(groupFor(body, agent)).toBeUndefined();
		}
	});

	it('keeps AI training crawlers off a whole tenant host', async () => {
		const body = await fetchRobots({ slug: 'example', custom_domain: 'events.example.org' });
		for (const agent of AI_TRAINING_AGENTS) {
			expect(groupFor(body, agent)).toMatch(/^Disallow: \/$/m);
		}
	});
});
