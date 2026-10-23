// Tenant-aware SEO (#1057): the builder on a tenant host vs the platform.
import { describe, it, expect } from 'vitest';
import { buildSeo } from '$lib/seo/build';
import { siteName, themeColor, tenantIconUrl, withSiteName, REVEL_THEME_COLOR } from './tenant';
import { tenantManifest } from './manifest';
import type {
	EventDetailSchema,
	EventSeriesRetrieveSchema,
	OrganizationRetrieveSchema,
	TenantOrganizationSchema
} from '$lib/api/generated/types.gen';

const tenant = {
	id: 'org-1',
	slug: 'acme',
	name: 'Acme Club',
	description: 'We throw parties',
	logo: '/media/logos/acme.png',
	logo_thumbnail_url: '/media/logos/acme-thumb.png',
	cover_art: null,
	custom_domain: 'events.acme.test',
	accept_membership_requests: true,
	has_membership_plans: false,
	has_resources: false
} as TenantOrganizationSchema;

const tenantUrl = (path: string) => new URL(`https://events.acme.test${path}`);
const platformUrl = (path: string) => new URL(`https://letsrevel.io${path}`);

const orgRef = {
	id: 'org-1',
	name: 'Acme Club',
	slug: 'acme',
	logo: null,
	cover_art: null,
	custom_domain: 'events.acme.test'
};

const event = {
	id: 'e1',
	name: 'Summer Party',
	slug: 'summer-party',
	description: 'desc',
	start: '2026-07-01T18:00:00Z',
	end: '2026-07-01T23:00:00Z',
	status: 'scheduled',
	requires_ticket: false,
	address: null,
	city: null,
	logo: null,
	cover_art: null,
	event_series: null,
	organization: orgRef
} as unknown as EventDetailSchema;

const org = {
	...orgRef,
	description: 'We throw parties'
} as unknown as OrganizationRetrieveSchema;

const series = {
	id: 's1',
	name: 'Monthly Night',
	slug: 'monthly',
	description: 'monthly',
	logo: null,
	cover_art: null,
	organization: orgRef
} as unknown as EventSeriesRetrieveSchema;

const noRevel = (value: unknown) => expect(JSON.stringify(value)).not.toMatch(/revel/i);

describe('site-name helpers', () => {
	it('chooses the org on a tenant host and Revel on the platform', () => {
		expect(siteName(tenant)).toBe('Acme Club');
		expect(siteName(null)).toBe('Revel');
		expect(siteName(undefined)).toBe('Revel');
		expect(withSiteName('Page', tenant)).toBe('Page | Acme Club');
		expect(withSiteName('Page', null)).toBe('Page | Revel');
		expect(withSiteName('Page', null, ' - ')).toBe('Page - Revel');
	});

	it('theme color: brand_theme when present and valid, else the Revel color', () => {
		expect(themeColor(null)).toBe(REVEL_THEME_COLOR);
		expect(themeColor(tenant)).toBe(REVEL_THEME_COLOR);
		const themed = { ...tenant, brand_theme: { light: { primary: '#112233' } } };
		expect(themeColor(themed)).toBe('#112233');
		for (const bad of ['red', 'url(x)', 42, null, '#12']) {
			const t = { ...tenant, brand_theme: { light: { primary: bad } } };
			expect(themeColor(t)).toBe(REVEL_THEME_COLOR);
		}
		expect(themeColor({ ...tenant, brand_theme: null })).toBe(REVEL_THEME_COLOR);
	});

	it('icon: logo thumbnail, then logo, as absolute media URLs', () => {
		expect(tenantIconUrl(tenant)).toMatch(/^https?:\/\/.+\/media\/logos\/acme-thumb\.png$/);
		expect(tenantIconUrl({ ...tenant, logo_thumbnail_url: null })).toMatch(
			/\/media\/logos\/acme\.png$/
		);
		expect(tenantIconUrl({ ...tenant, logo_thumbnail_url: null, logo: null })).toBeUndefined();
		expect(tenantIconUrl(null)).toBeUndefined();
	});
});

describe('buildSeo on a tenant host', () => {
	it('org page: title is just the org name; site name, no twitter:site, no Revel anywhere', () => {
		const cfg = buildSeo({ kind: 'org', url: tenantUrl('/'), lang: 'en', org, tenant });
		expect(cfg.title).toBe('Acme Club');
		expect(cfg.canonical).toBe('https://events.acme.test/');
		expect(cfg.og.siteName).toBe('Acme Club');
		expect(cfg.twitter.site).toBeUndefined();
		expect(cfg.og.logo).toMatch(/acme-thumb\.png$/);
		// Discovery points at the org's own page; `/` is not an oEmbed target.
		expect(cfg.oembed).toBe(
			`https://events.acme.test/oembed?url=${encodeURIComponent('https://events.acme.test/org/acme')}&format=json`
		);
		noRevel(cfg);
	});

	it('org page: no breadcrumb trail (it is the root), only the Organization block', () => {
		const cfg = buildSeo({ kind: 'org', url: tenantUrl('/'), lang: 'en', org, tenant });
		expect(cfg.jsonLd.map((j) => (j as Record<string, unknown>)['@type'])).toEqual([
			'Organization'
		]);
	});

	it('event: "Event | Org", breadcrumb rooted at the org home, no platform crumbs', () => {
		const cfg = buildSeo({
			kind: 'event',
			url: tenantUrl('/events/acme/summer-party'),
			lang: 'en',
			event,
			indexable: true,
			tenant
		});
		expect(cfg.title).toBe('Summer Party | Acme Club');
		expect(cfg.og.siteName).toBe('Acme Club');
		expect(cfg.twitter.site).toBeUndefined();
		const crumbs = cfg.jsonLd.find(
			(j) => (j as Record<string, unknown>)['@type'] === 'BreadcrumbList'
		) as { itemListElement: Array<{ name: string; item: string }> };
		expect(crumbs.itemListElement.map((c) => [c.name, c.item])).toEqual([
			['Acme Club', 'https://events.acme.test/'],
			['Summer Party', 'https://events.acme.test/events/acme/summer-party']
		]);
		noRevel(cfg);
	});

	it('series: "Series | Org" and an org-rooted breadcrumb', () => {
		const cfg = buildSeo({
			kind: 'series',
			url: tenantUrl('/events/acme/series/monthly'),
			lang: 'en',
			series,
			tenant
		});
		expect(cfg.title).toBe('Monthly Night | Acme Club');
		const crumbs = cfg.jsonLd.find(
			(j) => (j as Record<string, unknown>)['@type'] === 'BreadcrumbList'
		) as { itemListElement: Array<{ name: string }> };
		expect(crumbs.itemListElement.map((c) => c.name)).toEqual(['Acme Club', 'Monthly Night']);
		noRevel(cfg);
	});

	it.each([
		['login', { kind: 'auth', page: 'login' }, 'Log in | Acme Club'],
		['register', { kind: 'auth', page: 'register' }, 'Create your account | Acme Club'],
		['privacy', { kind: 'legal', doc: 'privacy' }, 'Privacy Policy | Acme Club'],
		['terms', { kind: 'legal', doc: 'terms' }, 'Terms of Service | Acme Club']
	] as const)('plain page %s: org suffix, no Revel card or handle', (_n, partial, title) => {
		const cfg = buildSeo({
			...partial,
			url: tenantUrl('/x'),
			lang: 'en',
			tenant
		} as Parameters<typeof buildSeo>[0]);
		expect(cfg.title).toBe(title);
		expect(cfg.og.siteName).toBe('Acme Club');
		expect(cfg.twitter.site).toBeUndefined();
		// The org's own image, never Revel's fixed card.
		expect(cfg.og.image).toMatch(/\/media\/logos\/acme\.png$/);
		noRevel(cfg);
	});
});

describe('buildSeo on the platform host is unchanged', () => {
	it('titles keep the "| Revel" suffix, handle and site name', () => {
		const ev = buildSeo({
			kind: 'event',
			url: platformUrl('/events/acme/summer-party'),
			lang: 'en',
			event,
			indexable: true
		});
		expect(ev.title).toBe('Summer Party | Revel');
		expect(ev.og.siteName).toBe('Revel');
		expect(ev.twitter.site).toBe('@letsrevel');
		expect(ev.og.logo).toBe('https://letsrevel.io/og-logo-v2.png');

		const o = buildSeo({ kind: 'org', url: platformUrl('/org/acme'), lang: 'en', org });
		expect(o.title).toBe('Acme Club | Revel');

		const s = buildSeo({
			kind: 'series',
			url: platformUrl('/events/acme/series/monthly'),
			lang: 'en',
			series
		});
		expect(s.title).toBe('Monthly Night | Acme Club | Revel');

		expect(
			buildSeo({ kind: 'auth', page: 'login', url: platformUrl('/login'), lang: 'en' }).title
		).toBe('Log in | Revel');
		expect(
			buildSeo({ kind: 'legal', doc: 'terms', url: platformUrl('/legal/terms'), lang: 'en' }).title
		).toBe('Terms of Service | Revel');
	});

	it('platform event breadcrumbs keep Home / Events / Org / Event', () => {
		const cfg = buildSeo({
			kind: 'event',
			url: platformUrl('/events/acme/summer-party'),
			lang: 'en',
			event,
			indexable: true
		});
		const crumbs = cfg.jsonLd.find(
			(j) => (j as Record<string, unknown>)['@type'] === 'BreadcrumbList'
		) as { itemListElement: Array<{ name: string }> };
		expect(crumbs.itemListElement.map((c) => c.name)).toEqual([
			'Home',
			'Events',
			'Acme Club',
			'Summer Party'
		]);
	});

	it('plain pages keep the default card and twitter:site', () => {
		const cfg = buildSeo({
			kind: 'auth',
			page: 'login',
			url: platformUrl('/login'),
			lang: 'en'
		});
		expect(cfg.og.image).toBe('https://letsrevel.io/og-image-v3.png');
		expect(cfg.twitter.site).toBe('@letsrevel');
	});
});

describe('tenant manifest', () => {
	it('carries the org name, root start_url, logo icons and theme color', () => {
		const m = tenantManifest({
			...tenant,
			brand_theme: { light: { primary: '#abcdef' } }
		} as never);
		expect(m.name).toBe('Acme Club');
		expect(m.short_name).toBe('Acme Club');
		expect(m.start_url).toBe('/');
		expect(m.theme_color).toBe('#abcdef');
		const icons = m.icons as Array<{ src: string }>;
		expect(icons[0].src).toMatch(/^https?:\/\/.+acme-thumb\.png$/);
		expect(icons[1].src).toMatch(/^https?:\/\/.+acme\.png$/);
		noRevel(m);
	});

	it('truncates a long short_name and falls back to the Revel theme color', () => {
		const m = tenantManifest({ ...tenant, name: 'The Very Long Club Name', logo: null });
		expect((m.short_name as string).length).toBeLessThanOrEqual(12);
		expect(m.theme_color).toBe(REVEL_THEME_COLOR);
		expect((m.icons as unknown[]).length).toBe(1);
	});
});
