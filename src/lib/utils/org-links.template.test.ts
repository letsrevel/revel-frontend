import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** The template is read from the runtime env; re-mock and re-import per case. */
async function load(template?: string) {
	vi.resetModules();
	vi.doMock('$app/environment', () => ({ browser: false }));
	vi.doMock('$env/dynamic/public', () => ({
		env: template === undefined ? {} : { PUBLIC_CUSTOM_DOMAIN_URL_TEMPLATE: template }
	}));
	return import('./org-links');
}

describe('customDomainOrigin', () => {
	beforeEach(() => {
		vi.spyOn(console, 'warn').mockImplementation(() => undefined);
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('defaults to https://{hostname}', async () => {
		const { customDomainOrigin } = await load();
		expect(customDomainOrigin('Tenant.Example.com')).toBe('https://tenant.example.com');
	});

	it('honours an http template with a port', async () => {
		const { customDomainOrigin, orgHref, orgOrigin } = await load('http://{hostname}:5173');
		expect(customDomainOrigin('tenant.localhost')).toBe('http://tenant.localhost:5173');
		expect(orgOrigin({ custom_domain: 'tenant.localhost' })).toBe('http://tenant.localhost:5173');
		expect(orgHref({ custom_domain: 'tenant.localhost' }, '/org/x?a=1')).toBe(
			'http://tenant.localhost:5173/org/x?a=1'
		);
	});

	it('compares hostnames, not origins, for the already-on-domain check', async () => {
		const { orgHref } = await load('http://{hostname}:5173');
		expect(orgHref({ custom_domain: 'paid.localhost' }, '/org/x', 'paid.localhost')).toBe('/org/x');
	});

	it('returns null for malformed hostnames', async () => {
		const { customDomainOrigin } = await load();
		expect(customDomainOrigin('evil.com/@x')).toBeNull();
		expect(customDomainOrigin(null)).toBeNull();
	});

	it.each([
		'{hostname}',
		'ftp://{hostname}',
		'https://static.example.com',
		'javascript:{hostname}'
	])('falls back to the default for invalid template %s (warns once)', async (bad) => {
		const { customDomainOrigin } = await load(bad);
		expect(customDomainOrigin('a.example.com')).toBe('https://a.example.com');
		expect(customDomainOrigin('b.example.com')).toBe('https://b.example.com');
		expect(console.warn).toHaveBeenCalledTimes(1);
	});
});
