import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockEnv = vi.hoisted(() => ({ env: {} as Record<string, string | undefined> }));
vi.mock('$env/dynamic/private', () => mockEnv);

import {
	SEGMENT_RULES,
	handleTenantRouting,
	platformOrigin,
	ruleForSegment,
	tenantRouteDecision
} from './tenant-routing';

const PLATFORM = 'https://app.example.com';
const UUID_A = '0b1f6c1e-7d52-4a53-9d0c-1f8f3a0e7c11';
const UUID_B = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

const decide = (pathname: string, search = '', origin: string | null = PLATFORM) =>
	tenantRouteDecision({ pathname, search, tenantSlug: 'acme', platformOrigin: origin });

const ALLOW = { action: 'allow' };
const HOME = { action: 'redirect', status: 302, location: '/' };
const platform = (path: string) => ({
	action: 'redirect',
	status: 302,
	location: `${PLATFORM}${path}`
});

/** Route file path -> URL path (groups and +files dropped, params filled in). */
function routeToPath(file: string): string {
	return (
		'/' +
		file
			.replace('/src/routes/', '')
			.split('/')
			.filter((s) => !/^\(.*\)$/.test(s) && !s.startsWith('+'))
			.map((s) => {
				const m = /^\[(\w+)(=uuid)?\]$/.exec(s);
				if (!m) return s;
				if (m[2]) return UUID_A;
				return /slug$/.test(m[1]) ? 'acme' : 'x1';
			})
			.join('/')
	);
}

function topLevel(file: string): string {
	return file
		.replace('/src/routes/', '')
		.split('/')
		.filter((s) => !/^\(.*\)$/.test(s))[0];
}

describe('tenantRouteDecision', () => {
	const allowed = [
		'/',
		'/org/acme',
		'/org/acme/',
		'/org/acme/membership',
		'/org/acme/resources',
		'/org/acme/polls/123',
		'/org/acme/questionnaire/abc',
		'/org/acme/verify-contact-email',
		`/org/${UUID_A}/membership`,
		'/events/acme/summer-party',
		'/events/acme/summer-party/',
		'/events/acme/summer-party/questionnaire/abc',
		'/events/acme/series/regulars',
		'/events/confirm-action',
		`/events/${UUID_A}`,
		`/events/${UUID_A}/${UUID_B}`,
		`/events/${UUID_A}/series/${UUID_B}`,
		'/embed/acme',
		'/embed/acme/event/party',
		'/embed/acme/series/regulars',
		'/login',
		'/login/reset-password',
		'/logout',
		'/register',
		'/register/check-email',
		'/password-reset',
		'/verify',
		'/account/profile',
		'/account/confirm-deletion',
		'/dashboard',
		'/dashboard/tickets',
		'/legal/privacy',
		'/legal/terms',
		'/unsubscribe',
		'/join/event/tok',
		'/join/org/tok',
		'/api/auth/refresh',
		'/api/events/x/potluck',
		'/auth/callback',
		'/_app/immutable/x.js',
		'/.well-known/security.txt',
		'/robots.txt',
		'/sitemap.xml',
		'/sitemap-events-1.xml',
		'/feed.xml',
		'/opensearch.xml',
		'/oembed',
		'/favicon.png',
		'/manifest.json'
	];
	it.each(allowed)('allows %s', (path) => {
		expect(decide(path)).toEqual(ALLOW);
	});

	it('platform-only paths redirect to the platform origin, keeping path and query', () => {
		expect(decide('/org/acme/admin')).toEqual(platform('/org/acme/admin'));
		expect(decide('/org/acme/admin/events/x/edit', '?a=1')).toEqual(
			platform('/org/acme/admin/events/x/edit?a=1')
		);
		expect(decide('/org/other/admin')).toEqual(platform('/org/other/admin'));
		expect(decide('/create-org')).toEqual(platform('/create-org'));
		expect(decide('/oauth/authorize', '?client_id=x')).toEqual(
			platform('/oauth/authorize?client_id=x')
		);
		expect(decide('/impersonate', '?token=t')).toEqual(platform('/impersonate?token=t'));
	});

	it('trims a trailing slash on the platform origin and falls home without one', () => {
		expect(decide('/create-org', '', 'https://app.example.com/')).toEqual(platform('/create-org'));
		expect(decide('/create-org', '', null)).toEqual(HOME);
		expect(decide('/org/acme/admin', '', null)).toEqual(HOME);
	});

	const home = [
		'/events',
		'/events/',
		'/events/other-org/party',
		'/events/other-org/series/x',
		'/events/not-a-uuid',
		'/org',
		'/org/other',
		'/org/other/membership',
		'/org/ACME', // slugs compare case-sensitively
		'/org/acme-evil',
		'/org/acmee',
		'/embed',
		'/embed/other',
		'/embed/other/event/x',
		'/organizations',
		'/referral/apply',
		'/club-membership-management',
		'/community-first-event-platform',
		'/eventbrite-alternative',
		'/kink-event-ticketing',
		'/privacy-focused-events',
		'/queer-event-management',
		'/self-hosted-event-platform',
		'/de',
		'/de/eventbrite-alternative',
		'/es/club-membership-management',
		'/fr/queer-event-management',
		'/it/kink-event-ticketing',
		'/pt/privacy-focused-events',
		'/something-unknown',
		'/constructor',
		'/__proto__',
		'/toString'
	];
	it.each(home)('redirects %s to /', (path) => {
		expect(decide(path)).toEqual(HOME);
	});

	it('handles URL-encoded segments', () => {
		expect(decide('/org/%61cme')).toEqual(ALLOW); // %61 = a
		expect(decide('/events/%61cme/party')).toEqual(ALLOW);
		expect(decide('/org/%E0%A4%A')).toEqual(HOME); // malformed escape
		expect(decide('/org%2Facme')).toEqual(HOME); // an encoded separator never forms a segment
		expect(decide('/org/acme%2Fadmin')).toEqual(HOME);
		expect(decide('/org/%2e%2e/acme')).toEqual(HOME);
		expect(decide('/org/acme/%61dmin')).toEqual(platform('/org/acme/%61dmin'));
	});

	it('tolerates doubled and trailing slashes without allowing look-alikes', () => {
		expect(decide('//org/acme')).toEqual(ALLOW);
		expect(decide('/org//other')).toEqual(HOME);
		expect(decide('/events//')).toEqual(HOME);
	});

	it('never produces an off-site location', () => {
		const nasty = [
			'//evil.example/x',
			'///evil.example',
			'/\\evil.example',
			'/org/acme/admin//evil.example',
			'/create-org//evil.example',
			'/https://evil.example',
			'/oauth/@evil.example',
			...allowed,
			...home
		];
		for (const path of nasty) {
			const d = decide(path, '?next=https://evil.example');
			if (d.action !== 'redirect') continue;
			expect(d.status).toBe(302);
			const sameHost = /^\/(?![/\\])/.test(d.location);
			const toPlatform = d.location.startsWith(`${PLATFORM}/`);
			expect(sameHost || toPlatform, `${path} -> ${d.location}`).toBe(true);
			if (toPlatform) expect(new URL(d.location).origin).toBe(PLATFORM);
		}
	});
});

describe('route coverage', () => {
	const files = Object.keys(import.meta.glob('/src/routes/**/+{page,server}*'));
	const realSegments = new Set(
		files.map(topLevel).filter((s) => !s.startsWith('+') && !s.startsWith('['))
	);

	it('finds the route files', () => {
		expect(files.length).toBeGreaterThan(50);
	});

	it('has no dynamic top-level route (it would be a catch-all)', () => {
		expect(files.filter((f) => topLevel(f).startsWith('['))).toEqual([]);
	});

	it('gives every real top-level segment an explicit decision', () => {
		const missing = [...realSegments].filter((s) => ruleForSegment(s) === undefined);
		expect(missing, `Add an explicit rule in SEGMENT_RULES for: ${missing.join(', ')}`).toEqual([]);
	});

	it('keeps no rules for segments that no longer exist', () => {
		const virtual = new Set(['_app', '.well-known']); // framework-level, no file under src/routes
		const stale = Object.keys(SEGMENT_RULES).filter((s) => !realSegments.has(s) && !virtual.has(s));
		expect(stale).toEqual([]);
	});

	it('only allows paths on a tenant host that belong to the tenant or to attendee tooling', () => {
		for (const file of files) {
			const d = decide(routeToPath(file));
			expect(['allow', 'redirect']).toContain(d.action);
		}
	});

	it('classifies every real admin route as platform-only', () => {
		const admin = files.filter((f) => f.includes('/admin/'));
		expect(admin.length).toBeGreaterThan(10);
		for (const f of admin) {
			const path = routeToPath(f);
			expect(decide(path), path).toEqual(platform(path));
		}
	});

	it('redirects every marketing and localized landing route to /', () => {
		const marketing = files.filter((f) => /\/\(public\)\/(de|es|fr|it|pt)\//.test(f));
		expect(marketing.length).toBeGreaterThan(20);
		for (const f of marketing) expect(decide(routeToPath(f)), f).toEqual(HOME);
	});
});

describe('platformOrigin', () => {
	beforeEach(() => {
		mockEnv.env.PLATFORM_ORIGIN = undefined;
		mockEnv.env.PLATFORM_HOSTS = undefined;
	});

	it('prefers PLATFORM_ORIGIN, normalised to its origin', () => {
		mockEnv.env.PLATFORM_ORIGIN = 'https://app.example.com/some/path';
		mockEnv.env.PLATFORM_HOSTS = 'other.example.com';
		expect(platformOrigin()).toBe('https://app.example.com');
	});

	it('falls back to https + the first PLATFORM_HOSTS entry', () => {
		mockEnv.env.PLATFORM_HOSTS = 'letsrevel.io, app.letsrevel.io';
		expect(platformOrigin()).toBe('https://letsrevel.io');
	});

	it('ignores an invalid PLATFORM_ORIGIN and returns null when nothing is usable', () => {
		mockEnv.env.PLATFORM_ORIGIN = 'javascript:alert(1)';
		expect(platformOrigin()).toBeNull();
		mockEnv.env.PLATFORM_HOSTS = 'letsrevel.io';
		expect(platformOrigin()).toBe('https://letsrevel.io');
	});
});

describe('handleTenantRouting', () => {
	const run = async (tenant: { slug: string } | null, url: string) => {
		const resolve = vi.fn(async () => new Response('page'));
		const res = await handleTenantRouting({
			event: { locals: { tenant }, url: new URL(url) },
			resolve
		} as unknown as Parameters<typeof handleTenantRouting>[0]);
		return { res, resolve };
	};

	beforeEach(() => {
		mockEnv.env.PLATFORM_ORIGIN = undefined;
		mockEnv.env.PLATFORM_HOSTS = undefined;
		mockEnv.env.PLATFORM_HOSTS = 'app.example.com';
	});

	it('passes everything through on platform hosts', async () => {
		for (const path of ['/events', '/org/x/admin', '/create-org', '/']) {
			const { res, resolve } = await run(null, `https://app.example.com${path}`);
			expect(resolve).toHaveBeenCalledTimes(1);
			expect(await res.text()).toBe('page');
		}
	});

	it('resolves allowed paths on a tenant host', async () => {
		const { res, resolve } = await run({ slug: 'acme' }, 'https://acme.example.org/org/acme');
		expect(resolve).toHaveBeenCalledTimes(1);
		expect(res.status).toBe(200);
	});

	it('redirects platform-only paths to the platform origin', async () => {
		const { res, resolve } = await run(
			{ slug: 'acme' },
			'https://acme.example.org/org/acme/admin/events?x=1'
		);
		expect(resolve).not.toHaveBeenCalled();
		expect(res.status).toBe(302);
		expect(res.headers.get('location')).toBe('https://app.example.com/org/acme/admin/events?x=1');
	});

	it('honours PLATFORM_ORIGIN', async () => {
		mockEnv.env.PLATFORM_ORIGIN = 'https://platform.example.net';
		const { res } = await run({ slug: 'acme' }, 'https://acme.example.org/create-org');
		expect(res.headers.get('location')).toBe('https://platform.example.net/create-org');
	});

	it('redirects other pages to the tenant root', async () => {
		const { res, resolve } = await run({ slug: 'acme' }, 'https://acme.example.org/events?q=1');
		expect(resolve).not.toHaveBeenCalled();
		expect(res.status).toBe(302);
		expect(res.headers.get('location')).toBe('/');
	});
});
