// Tenant-aware SEO/XML endpoints (#1057): each surface on a tenant host and on the platform.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockEnv = vi.hoisted(() => ({ env: {} as Record<string, string | undefined> }));
vi.mock('$env/dynamic/private', () => mockEnv);

const listEvents = vi.fn();
const listSeries = vi.fn();
const listOrgs = vi.fn();

vi.mock('$lib/api', () => ({
	eventpublicdiscoveryListEvents: (...a: unknown[]) => listEvents(...a),
	eventseriesListEventSeries: (...a: unknown[]) => listSeries(...a),
	organizationListOrganizations: (...a: unknown[]) => listOrgs(...a),
	eventpublicdetailsGetEventBySlugs: vi.fn(async () => ({ data: null })),
	eventseriesGetEventSeriesBySlugs: vi.fn(async () => ({ data: null })),
	organizationGetOrganization: vi.fn(async () => ({
		data: { name: 'Acme Club', slug: 'acme', cover_art: null }
	}))
}));

import { GET as sitemapIndex } from './sitemap.xml/+server';
import { GET as sitemapStatic } from './sitemap-static.xml/+server';
import { GET as sitemapEvents } from './sitemap-events-[page].xml/+server';
import { GET as sitemapSeries } from './sitemap-series-[page].xml/+server';
import { GET as sitemapOrgs } from './sitemap-orgs-[page].xml/+server';
import { GET as robots } from './robots.txt/+server';
import { GET as feed } from './feed.xml/+server';
import { GET as opensearch } from './opensearch.xml/+server';
import { GET as manifest } from './manifest.webmanifest/+server';
import { GET as oembed } from './oembed/+server';
import type { TenantOrganizationSchema } from '$lib/api/generated/types.gen';

const tenant = {
	id: 'org-uuid-1',
	slug: 'acme',
	name: 'Acme Club',
	description: 'We throw <b>parties</b>',
	logo: '/media/logos/acme.png',
	logo_thumbnail_url: '/media/logos/acme-thumb.png',
	custom_domain: 'events.acme.test',
	accept_membership_requests: true,
	has_membership_plans: false,
	has_resources: false
} as TenantOrganizationSchema;

// Handlers are called with a hand-built event; one cast keeps the tests readable.
type Handler = (event: never) => Promise<Response> | Response;
const call = (handler: unknown, event: Record<string, unknown>) =>
	(handler as Handler)({ fetch, setHeaders: vi.fn(), ...event } as never);

const T = 'https://events.acme.test';
const P = 'https://letsrevel.io';
const onTenant = (path: string, extra: Record<string, unknown> = {}) => ({
	url: new URL(`${T}${path}`),
	locals: { tenant },
	...extra
});
const onPlatform = (path: string, extra: Record<string, unknown> = {}) => ({
	url: new URL(`${P}${path}`),
	locals: { tenant: null },
	...extra
});

const evt = {
	slug: 'party',
	name: 'Party',
	start: '2099-01-01T18:00:00Z',
	updated_at: null,
	created_at: '2026-01-01T00:00:00Z',
	cover_art: null,
	logo: null,
	description: 'x',
	city: null,
	organization: { slug: 'acme', name: 'Acme Club' }
};

beforeEach(() => {
	listEvents.mockReset().mockResolvedValue({ data: { count: 1, results: [evt] } });
	listSeries.mockReset().mockResolvedValue({
		data: {
			count: 1,
			results: [{ slug: 'monthly', name: 'Monthly', organization: { slug: 'acme' } }]
		}
	});
	listOrgs.mockReset().mockResolvedValue({ data: { count: 3, results: [] } });
});

describe('sitemap.xml', () => {
	it('tenant: static + events + series only, scoped to the org id, on the tenant origin', async () => {
		const body = await (await call(sitemapIndex, onTenant('/sitemap.xml'))).text();
		expect(body).toContain(`<loc>${T}/sitemap-static.xml</loc>`);
		expect(body).toContain(`<loc>${T}/sitemap-events-1.xml</loc>`);
		expect(body).toContain(`<loc>${T}/sitemap-series-1.xml</loc>`);
		expect(body).not.toContain('sitemap-orgs');
		expect(listOrgs).not.toHaveBeenCalled();
		expect(listEvents.mock.calls[0][0].query.organization).toBe('org-uuid-1');
		expect(listSeries.mock.calls[0][0].query.organization).toBe('org-uuid-1');
	});

	it('platform: unscoped queries and the orgs sitemap', async () => {
		const body = await (await call(sitemapIndex, onPlatform('/sitemap.xml'))).text();
		expect(body).toContain(`<loc>${P}/sitemap-orgs-1.xml</loc>`);
		expect(listEvents.mock.calls[0][0].query).not.toHaveProperty('organization');
		expect(listSeries.mock.calls[0][0].query).not.toHaveProperty('organization');
		expect(listOrgs).toHaveBeenCalled();
	});
});

describe('child sitemaps', () => {
	it('tenant static: only the org home, no marketing or auth pages', async () => {
		const body = await (await call(sitemapStatic, onTenant('/sitemap-static.xml'))).text();
		expect(body.match(/<loc>/g)).toHaveLength(1);
		expect(body).toContain(`<loc>${T}/</loc>`);
		expect(body).not.toMatch(/eventbrite|login|legal|organizations/);
	});

	it('platform static still lists the marketing pages', async () => {
		const body = await (await call(sitemapStatic, onPlatform('/sitemap-static.xml'))).text();
		expect(body).toContain(`<loc>${P}/eventbrite-alternative</loc>`);
		expect(body).toContain(`<loc>${P}/organizations</loc>`);
	});

	it('tenant events and series: org filter, tenant-origin URLs', async () => {
		const ev = await (
			await call(sitemapEvents, onTenant('/sitemap-events-1.xml', { params: { page: '1' } }))
		).text();
		expect(ev).toContain(`<loc>${T}/events/acme/party</loc>`);
		expect(listEvents.mock.calls[0][0].query.organization).toBe('org-uuid-1');
		const se = await (
			await call(sitemapSeries, onTenant('/sitemap-series-1.xml', { params: { page: '1' } }))
		).text();
		expect(se).toContain(`<loc>${T}/events/acme/series/monthly</loc>`);
		expect(listSeries.mock.calls[0][0].query.organization).toBe('org-uuid-1');
	});

	it('platform events: unscoped', async () => {
		await call(sitemapEvents, onPlatform('/sitemap-events-1.xml', { params: { page: '1' } }));
		expect(listEvents.mock.calls[0][0].query).not.toHaveProperty('organization');
	});

	it('orgs sitemap is a 404 on a tenant host', async () => {
		await expect(
			call(sitemapOrgs, onTenant('/sitemap-orgs-1.xml', { params: { page: '1' } }))
		).rejects.toMatchObject({ status: 404 });
	});
});

describe('robots.txt', () => {
	it('tenant: its own sitemap only, no platform paths, no Revel', async () => {
		const body = await (await call(robots, onTenant('/robots.txt'))).text();
		expect(body).toContain(`Sitemap: ${T}/sitemap.xml`);
		expect(body.match(/^Sitemap:/gm)).toHaveLength(1);
		expect(body).not.toMatch(/create-org|\/org\/\*\/admin|revel/i);
		expect(body).toContain('Disallow: /dashboard');
		expect(body).toContain('User-agent: AhrefsBot');
	});

	it('platform: unchanged (all sub-sitemaps, platform disallows)', async () => {
		const body = await (await call(robots, onPlatform('/robots.txt'))).text();
		expect(body).toContain(`Sitemap: ${P}/sitemap-orgs-1.xml`);
		expect(body).toContain('Disallow: /create-org');
		expect(body).toContain('Disallow: /org/*/admin');
	});
});

describe('feed.xml', () => {
	it('tenant: org channel, scoped query, no Revel contact details', async () => {
		const body = await (await call(feed, onTenant('/feed.xml'))).text();
		expect(body).toContain('<title>Acme Club - Upcoming Events</title>');
		expect(body).toContain(`<link>${T}/</link>`);
		expect(body).toContain(`<link>${T}/events/acme/party</link>`);
		expect(body).toContain('<description>We throw parties</description>');
		expect(body).not.toMatch(/revel|managingEditor|webMaster/i);
		expect(listEvents.mock.calls[0][0].query.organization).toBe('org-uuid-1');
	});

	it('platform: unchanged channel metadata', async () => {
		const body = await (await call(feed, onPlatform('/feed.xml'))).text();
		expect(body).toContain('<title>Revel - Upcoming Events</title>');
		expect(body).toContain(`<link>${P}/events</link>`);
		expect(body).toContain('<managingEditor>contact@letsrevel.io (Revel Team)</managingEditor>');
		expect(listEvents.mock.calls[0][0].query).not.toHaveProperty('organization');
	});
});

describe('opensearch.xml', () => {
	it('is a 404 on a tenant host and unchanged on the platform', async () => {
		await expect(call(opensearch, onTenant('/opensearch.xml'))).rejects.toMatchObject({
			status: 404
		});
		const body = await (await call(opensearch, onPlatform('/opensearch.xml'))).text();
		expect(body).toContain('<ShortName>Revel</ShortName>');
	});
});

describe('manifest.webmanifest', () => {
	it('tenant: org manifest; platform: 404 (keeps static /manifest.json)', async () => {
		const res = await call(manifest, onTenant('/manifest.webmanifest'));
		expect(res.headers.get('content-type')).toContain('application/manifest+json');
		const json = await res.json();
		expect(json.name).toBe('Acme Club');
		expect(json.start_url).toBe('/');
		await expect(call(manifest, onPlatform('/manifest.webmanifest'))).rejects.toMatchObject({
			status: 404
		});
	});
});

describe('oembed', () => {
	it('tenant: another org URL is unsupported (404) before any lookup', async () => {
		const target = encodeURIComponent(`${T}/org/other-org`);
		await expect(call(oembed, onTenant(`/oembed?url=${target}&format=json`))).rejects.toMatchObject(
			{ status: 404 }
		);
	});

	it('tenant: its own org page resolves, provider is the org, on the tenant origin', async () => {
		const target = encodeURIComponent(`${T}/org/acme`);
		const res = await call(oembed, onTenant(`/oembed?url=${target}&format=json`));
		const json = await res.json();
		expect(json.provider_name).toBe('Acme Club');
		expect(json.provider_url).toBe(T);
		expect(json.html).toContain(`${T}/embed/acme`);
	});

	it('platform: provider stays Revel', async () => {
		const target = encodeURIComponent(`${P}/org/acme`);
		const json = await (await call(oembed, onPlatform(`/oembed?url=${target}&format=json`))).json();
		expect(json.provider_name).toBe('Revel');
	});
});

describe('platform SEO links to custom-domain orgs', () => {
	const withDomain = {
		...evt,
		organization: { slug: 'acme', name: 'Acme Club', custom_domain: 'events.acme.test' }
	};
	const plain = { ...evt, slug: 'other', organization: { slug: 'beta', name: 'Beta' } };

	beforeEach(() => {
		mockEnv.env.PLATFORM_HOSTS = 'letsrevel.io';
		listEvents.mockReset().mockResolvedValue({ data: { count: 2, results: [withDomain, plain] } });
		listSeries.mockReset().mockResolvedValue({
			data: {
				count: 2,
				results: [
					{ slug: 'monthly', name: 'Monthly', organization: withDomain.organization },
					{ slug: 'weekly', name: 'Weekly', organization: plain.organization }
				]
			}
		});
		listOrgs.mockReset().mockResolvedValue({
			data: {
				count: 2,
				results: [
					{ slug: 'acme', name: 'Acme', custom_domain: 'events.acme.test' },
					{ slug: 'beta', name: 'Beta' }
				]
			}
		});
	});

	afterEach(() => {
		mockEnv.env.PLATFORM_HOSTS = undefined;
	});

	it('events sitemap: custom-domain org on its origin, others on the platform', async () => {
		const body = await (
			await call(sitemapEvents, onPlatform('/sitemap-events-1.xml', { params: { page: '1' } }))
		).text();
		expect(body).toContain(`<loc>${T}/events/acme/party</loc>`);
		expect(body).toContain(`<loc>${P}/events/beta/other</loc>`);
	});

	it('series sitemap', async () => {
		const body = await (
			await call(sitemapSeries, onPlatform('/sitemap-series-1.xml', { params: { page: '1' } }))
		).text();
		expect(body).toContain(`<loc>${T}/events/acme/series/monthly</loc>`);
		expect(body).toContain(`<loc>${P}/events/beta/series/weekly</loc>`);
	});

	it('orgs sitemap', async () => {
		const body = await (
			await call(sitemapOrgs, onPlatform('/sitemap-orgs-1.xml', { params: { page: '1' } }))
		).text();
		expect(body).toContain(`<loc>${T}/org/acme</loc>`);
		expect(body).toContain(`<loc>${P}/org/beta</loc>`);
	});

	it('feed', async () => {
		const body = await (await call(feed, onPlatform('/feed.xml'))).text();
		expect(body).toContain(`<link>${T}/events/acme/party</link>`);
		expect(body).toContain(`<link>${P}/events/beta/other</link>`);
	});

	it('tenant mode off: nothing points at a custom domain', async () => {
		mockEnv.env.PLATFORM_HOSTS = undefined;
		const ev = await (
			await call(sitemapEvents, onPlatform('/sitemap-events-1.xml', { params: { page: '1' } }))
		).text();
		expect(ev).toContain(`<loc>${P}/events/acme/party</loc>`);
		expect(ev).not.toContain(T);
		const fd = await (await call(feed, onPlatform('/feed.xml'))).text();
		expect(fd).not.toContain(T);
		const orgs = await (
			await call(sitemapOrgs, onPlatform('/sitemap-orgs-1.xml', { params: { page: '1' } }))
		).text();
		expect(orgs).toContain(`<loc>${P}/org/acme</loc>`);
	});
});
