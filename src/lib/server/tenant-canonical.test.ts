import { describe, it, expect, vi, beforeEach } from 'vitest';

const getById = vi.hoisted(() => vi.fn());
vi.mock('$lib/api', () => ({ organizationGetOrganizationCustomDomain: getById }));
const mockEnv = vi.hoisted(() => ({ env: {} as Record<string, string | undefined> }));
vi.mock('$env/dynamic/private', () => mockEnv);

import {
	canonicalTenantRedirect,
	canonicalTenantUrl,
	serverLinkContext,
	tenantReturnUrl
} from './tenant-canonical';

// Tenant mode is ON only when PLATFORM_HOSTS is set (#1056).
beforeEach(() => {
	mockEnv.env.PLATFORM_HOSTS = 'app.example.com';
	mockEnv.env.PLATFORM_ORIGIN = undefined;
});

const locals = (tenant: unknown = null) => ({ tenant }) as unknown as App.Locals;
const url = (s: string) => new URL(s);

describe('canonicalTenantUrl', () => {
	it('points at the custom domain, keeping path and query', () => {
		expect(
			canonicalTenantUrl(
				locals(),
				{ custom_domain: 'events.example.org' },
				url('https://app.example.com/events/acme/party?payment_success=1&x=%20y')
			)
		).toBe('https://events.example.org/events/acme/party?payment_success=1&x=%20y');
	});

	it('is null without a custom domain', () => {
		const u = url('https://app.example.com/org/acme');
		expect(canonicalTenantUrl(locals(), { custom_domain: null }, u)).toBeNull();
		expect(canonicalTenantUrl(locals(), {}, u)).toBeNull();
		expect(canonicalTenantUrl(locals(), { custom_domain: '' }, u)).toBeNull();
	});

	it('is null on a tenant host', () => {
		expect(
			canonicalTenantUrl(
				locals({ slug: 'acme' }),
				{ custom_domain: 'events.example.org' },
				url('https://events.example.org/')
			)
		).toBeNull();
	});

	it('is null while tenant mode is off (no PLATFORM_HOSTS)', () => {
		mockEnv.env.PLATFORM_HOSTS = undefined;
		expect(
			canonicalTenantUrl(
				locals(),
				{ custom_domain: 'events.example.org' },
				url('https://app.example.com/org/acme')
			)
		).toBeNull();
	});

	it('is null when the custom domain equals the request host (misconfiguration guard)', () => {
		expect(
			canonicalTenantUrl(
				locals(),
				{ custom_domain: 'app.example.com' },
				url('https://app.example.com/org/acme')
			)
		).toBeNull();
		expect(
			canonicalTenantUrl(
				locals(),
				{ custom_domain: 'APP.example.com' },
				url('https://app.example.com/org/acme?x=1')
			)
		).toBeNull();
	});

	it('refuses a domain that is not a bare hostname', () => {
		const u = url('https://app.example.com/org/acme');
		for (const bad of ['evil.com/path', 'a@evil.com', 'evil.com:8080', '//evil.com', 'a b.com']) {
			expect(canonicalTenantUrl(locals(), { custom_domain: bad }, u), bad).toBeNull();
		}
	});
});

describe('canonicalTenantRedirect', () => {
	it('throws a 301 redirect on the platform host', () => {
		try {
			canonicalTenantRedirect(
				locals(),
				{ custom_domain: 'events.example.org' },
				url('https://app.example.com/org/acme?ot=t')
			);
			expect.unreachable();
		} catch (e) {
			expect(e).toMatchObject({
				status: 301,
				location: 'https://events.example.org/org/acme?ot=t'
			});
		}
	});

	it('does not redirect while tenant mode is off', () => {
		mockEnv.env.PLATFORM_HOSTS = undefined;
		expect(() =>
			canonicalTenantRedirect(
				locals(),
				{ custom_domain: 'events.example.org' },
				url('https://app.example.com/org/acme')
			)
		).not.toThrow();
	});

	it('returns normally when there is nothing to do', () => {
		const u = url('https://app.example.com/org/acme');
		expect(() => canonicalTenantRedirect(locals(), { custom_domain: null }, u)).not.toThrow();
		expect(() =>
			canonicalTenantRedirect(locals({ slug: 'a' }), { custom_domain: 'x.example.org' }, u)
		).not.toThrow();
	});
});

describe('canonicalTenantUrl with a URL template', () => {
	it('uses PUBLIC_CUSTOM_DOMAIN_URL_TEMPLATE', async () => {
		vi.resetModules();
		vi.doMock('$app/environment', () => ({ browser: false }));
		vi.doMock('$env/dynamic/public', () => ({
			env: { PUBLIC_CUSTOM_DOMAIN_URL_TEMPLATE: 'http://{hostname}:5173' }
		}));
		const mod = await import('./tenant-canonical');
		expect(
			mod.canonicalTenantUrl(
				locals(),
				{ custom_domain: 'tenant.localhost' },
				url('http://localhost:5173/org/x?a=1')
			)
		).toBe('http://tenant.localhost:5173/org/x?a=1');
	});
});

describe('tenantReturnUrl (Stripe return hop)', () => {
	const ORG = '0b8f6c1e-3a2d-4c5b-9e7f-1a2b3c4d5e6f';
	const ret = url(
		`https://app.example.com/events/${ORG}/1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f?payment_success=true`
	);
	const f = vi.fn() as unknown as typeof fetch;

	beforeEach(() => getById.mockReset());

	it('sends a custom-domain org to the same UUID path on its domain', async () => {
		getById.mockResolvedValue({ data: { custom_domain: 'events.example.org' } });
		expect(await tenantReturnUrl(locals(), ORG, ret, f)).toBe(
			`https://events.example.org${ret.pathname}?payment_success=true`
		);
		expect(getById).toHaveBeenCalledWith(
			expect.objectContaining({ path: { organization_id: ORG } })
		);
	});

	it('is null when the org has no active domain (404) or on an error', async () => {
		getById.mockResolvedValueOnce({ data: undefined, error: { detail: 'nope' } });
		expect(await tenantReturnUrl(locals(), ORG, ret, f)).toBeNull();
		getById.mockRejectedValueOnce(new Error('down'));
		expect(await tenantReturnUrl(locals(), ORG, ret, f)).toBeNull();
	});

	it('never hops (or looks up) while tenant mode is off', async () => {
		mockEnv.env.PLATFORM_HOSTS = undefined;
		getById.mockResolvedValue({ data: { custom_domain: 'events.example.org' } });
		expect(await tenantReturnUrl(locals(), ORG, ret, f)).toBeNull();
		expect(getById).not.toHaveBeenCalled();
	});

	it('never hops to the request host itself', async () => {
		getById.mockResolvedValue({ data: { custom_domain: 'app.example.com' } });
		expect(await tenantReturnUrl(locals(), ORG, ret, f)).toBeNull();
	});

	it('never hops (or even looks up) on a tenant host, so the tenant route resolves itself', async () => {
		expect(await tenantReturnUrl(locals({ slug: 'acme' }), ORG, ret, f)).toBeNull();
		expect(getById).not.toHaveBeenCalled();
	});
});

describe('serverLinkContext', () => {
	it('mirrors the client page data: mode switch, tenant and platform origin', () => {
		expect(serverLinkContext(locals())).toEqual({
			tenant: null,
			customDomains: { enabled: true, platformOrigin: 'https://app.example.com' }
		});
		const tenant = { slug: 'acme' };
		expect(serverLinkContext(locals(tenant)).tenant).toBe(tenant);
	});

	it('is disabled without PLATFORM_HOSTS', () => {
		mockEnv.env.PLATFORM_HOSTS = undefined;
		expect(serverLinkContext(locals())).toEqual({
			tenant: null,
			customDomains: { enabled: false, platformOrigin: null }
		});
	});
});
