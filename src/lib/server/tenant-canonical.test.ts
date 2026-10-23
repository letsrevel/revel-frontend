import { describe, it, expect, vi } from 'vitest';
import { canonicalTenantRedirect, canonicalTenantUrl } from './tenant-canonical';

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
