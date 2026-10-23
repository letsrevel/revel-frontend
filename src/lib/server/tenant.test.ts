import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockEnv = vi.hoisted(() => ({ env: {} as Record<string, string | undefined> }));
vi.mock('$env/dynamic/private', () => mockEnv);
vi.mock('$env/dynamic/public', () => ({ env: { PUBLIC_API_URL: 'http://api.test' } }));

import {
	__resetTenantCache,
	handleTenant,
	isPlatformHost,
	normalizeHost,
	resolveTenant,
	tenantModeEnabled,
	type TenantOrganization
} from './tenant';

const org = (slug = 'acme'): TenantOrganization => ({
	id: `id-${slug}`,
	slug,
	name: slug,
	description: null,
	logo: null,
	cover_art: null,
	logo_thumbnail_url: null,
	cover_art_thumbnail_url: null,
	cover_art_social_url: null,
	custom_domain: `${slug}.example.com`,
	has_membership_plans: false,
	has_resources: false,
	accept_membership_requests: false
});

// The generated client parses by content-type, so the fake must declare JSON.
const json = (body: unknown, status = 200): Response =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => {
	mockEnv.env.PLATFORM_HOSTS = 'letsrevel.io, App.LetsRevel.io';
	__resetTenantCache();
});
afterEach(() => {
	vi.useRealTimers();
});

describe('platform host detection', () => {
	it('matches configured hosts case-insensitively, ignoring ports', () => {
		expect(isPlatformHost('letsrevel.io')).toBe(true);
		expect(isPlatformHost('LETSREVEL.IO:443')).toBe(true);
		expect(isPlatformHost('app.letsrevel.io:8080')).toBe(true);
		expect(isPlatformHost('acme.example.com')).toBe(false);
	});

	it('always treats loopback names as platform', () => {
		for (const h of ['localhost', 'localhost:3000', '127.0.0.1:3000', '[::1]:3000', '[::1]']) {
			expect(isPlatformHost(h)).toBe(true);
		}
	});

	it('treats subdomains of localhost as tenant candidates', () => {
		expect(isPlatformHost('tenant.localhost')).toBe(false);
		expect(isPlatformHost('tenant.localhost:5173')).toBe(false);
	});

	it('is off (everything platform) when PLATFORM_HOSTS is unset or empty', () => {
		mockEnv.env.PLATFORM_HOSTS = undefined;
		expect(isPlatformHost('acme.example.com')).toBe(true);
		mockEnv.env.PLATFORM_HOSTS = ' , ';
		expect(isPlatformHost('acme.example.com')).toBe(true);
	});

	it('tenantModeEnabled is true only with at least one platform host', () => {
		expect(tenantModeEnabled()).toBe(true);
		mockEnv.env.PLATFORM_HOSTS = undefined;
		expect(tenantModeEnabled()).toBe(false);
		mockEnv.env.PLATFORM_HOSTS = ' , ';
		expect(tenantModeEnabled()).toBe(false);
		mockEnv.env.PLATFORM_HOSTS = 'letsrevel.io';
		expect(tenantModeEnabled()).toBe(true);
	});

	it('normalizes hosts', () => {
		expect(normalizeHost('Foo.COM:8080')).toBe('foo.com');
		expect(normalizeHost('[::1]:3000')).toBe('[::1]');
		expect(normalizeHost('foo.com.')).toBe('foo.com');
	});
});

describe('resolveTenant cache', () => {
	it('caches a hit within the TTL and refetches after it', async () => {
		vi.useFakeTimers();
		const fetch = vi.fn(async () => json(org()));
		const r1 = await resolveTenant('acme.example.com', fetch);
		expect(r1).toEqual({ status: 'found', tenant: org() });
		await resolveTenant('ACME.example.com:443', fetch);
		expect(fetch).toHaveBeenCalledTimes(1);
		// The generated client hands fetch a Request, not a URL string.
		expect((fetch.mock.calls[0] as unknown[])[0]).toMatchObject({
			url: 'http://api.test/api/organizations/by-domain/acme.example.com'
		});

		vi.advanceTimersByTime(59_000);
		await resolveTenant('acme.example.com', fetch);
		expect(fetch).toHaveBeenCalledTimes(1);
		vi.advanceTimersByTime(2_000);
		await resolveTenant('acme.example.com', fetch);
		expect(fetch).toHaveBeenCalledTimes(2);
	});

	it('caches 404s with the shorter negative TTL', async () => {
		vi.useFakeTimers();
		const fetch = vi.fn(async () => new Response('', { status: 404 }));
		expect((await resolveTenant('nope.example.com', fetch)).status).toBe('unknown');
		await resolveTenant('nope.example.com', fetch);
		expect(fetch).toHaveBeenCalledTimes(1);
		vi.advanceTimersByTime(16_000);
		await resolveTenant('nope.example.com', fetch);
		expect(fetch).toHaveBeenCalledTimes(2);
	});

	it('does not cache upstream failures', async () => {
		const fetch = vi
			.fn<typeof globalThis.fetch>()
			.mockRejectedValueOnce(new Error('boom'))
			.mockResolvedValueOnce(new Response('', { status: 429 }))
			.mockResolvedValueOnce(new Response('', { status: 503 }))
			.mockResolvedValueOnce(json(org()));
		expect((await resolveTenant('a.example.com', fetch)).status).toBe('unavailable');
		expect((await resolveTenant('a.example.com', fetch)).status).toBe('unavailable');
		expect((await resolveTenant('a.example.com', fetch)).status).toBe('unavailable');
		expect((await resolveTenant('a.example.com', fetch)).status).toBe('found');
		expect(fetch).toHaveBeenCalledTimes(4);
	});

	it('dedupes concurrent in-flight lookups for the same host', async () => {
		let release!: (r: Response) => void;
		const fetch = vi.fn(
			() =>
				new Promise<Response>((resolve) => {
					release = resolve;
				})
		);
		const a = resolveTenant('acme.example.com', fetch);
		const b = resolveTenant('acme.example.com', fetch);
		// The SDK reaches fetch after its own async request setup.
		await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
		release(json(org()));
		expect(await a).toEqual(await b);
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it('caps the cache size, evicting the oldest entry', async () => {
		const fetch = vi.fn(async () => new Response('', { status: 404 }));
		for (let i = 0; i < 501; i++) await resolveTenant(`h${i}.example.com`, fetch);
		expect(fetch).toHaveBeenCalledTimes(501);
		await resolveTenant('h500.example.com', fetch); // newest still cached
		expect(fetch).toHaveBeenCalledTimes(501);
		await resolveTenant('h0.example.com', fetch); // oldest evicted
		expect(fetch).toHaveBeenCalledTimes(502);
	});

	it('a flood of unknown hosts never evicts a cached tenant', async () => {
		const fetch = vi.fn(async (req: Request) =>
			new URL(req.url).pathname.endsWith('/acme.example.com')
				? json(org())
				: new Response('', { status: 404 })
		);
		await resolveTenant('acme.example.com', fetch as unknown as typeof globalThis.fetch);
		for (let i = 0; i < 600; i++)
			await resolveTenant(`junk${i}.example.com`, fetch as unknown as typeof globalThis.fetch);
		const calls = fetch.mock.calls.length;
		expect(
			(await resolveTenant('acme.example.com', fetch as unknown as typeof globalThis.fetch)).status
		).toBe('found');
		expect(fetch.mock.calls.length).toBe(calls); // served from the positive cache
	});

	it('rejects implausible hostnames without calling upstream', async () => {
		const fetch = vi.fn();
		expect((await resolveTenant('a/b', fetch)).status).toBe('unknown');
		expect(fetch).not.toHaveBeenCalled();
	});
});

describe('handleTenant', () => {
	const run = (host: string, fetch: typeof globalThis.fetch) => {
		const event = {
			url: new URL(`https://${host}/`),
			fetch,
			locals: {} as App.Locals
		};
		const resolve = vi.fn(async () => new Response('ok'));
		// eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal RequestEvent stub
		const res = handleTenant({ event, resolve } as any);
		return { event, resolve, res };
	};

	it('passes platform hosts through with tenant = null', async () => {
		const fetch = vi.fn();
		const { event, resolve, res } = run('letsrevel.io', fetch);
		expect((await res).status).toBe(200);
		expect(event.locals.tenant).toBeNull();
		expect(resolve).toHaveBeenCalled();
		expect(fetch).not.toHaveBeenCalled();
	});

	it('sets locals.tenant for a known tenant host', async () => {
		const { event, resolve, res } = run(
			'acme.example.com',
			vi.fn(async () => json(org()))
		);
		expect((await res).status).toBe(200);
		expect(event.locals.tenant).toEqual(org());
		expect(resolve).toHaveBeenCalled();
	});

	it('answers a bare 404 for an unknown host without rendering', async () => {
		const { resolve, res } = run(
			'x.example.com',
			vi.fn(async () => new Response('', { status: 404 }))
		);
		const r = await res;
		expect(r.status).toBe(404);
		expect(await r.text()).toBe('Not found');
		expect(resolve).not.toHaveBeenCalled();
	});

	it('answers 503 with Retry-After when the lookup fails', async () => {
		const { resolve, res } = run(
			'x.example.com',
			vi.fn(async () => new Response('', { status: 500 }))
		);
		const r = await res;
		expect(r.status).toBe(503);
		expect(r.headers.get('retry-after')).toBe('5');
		expect(resolve).not.toHaveBeenCalled();
	});
});
