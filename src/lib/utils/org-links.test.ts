import { describe, expect, it } from 'vitest';
import {
	normalizeCustomDomain,
	orgHref,
	orgOrigin,
	rootRelative,
	type LinkContext
} from './org-links';

const PLATFORM = 'https://app.example.com';
/** Platform host, tenant mode on. */
const ON: LinkContext = {
	tenant: null,
	customDomains: { enabled: true, platformOrigin: PLATFORM }
};
/** A tenant host (tenant mode necessarily on). */
const onTenant = (domain: string, slug = 'acme', platformOrigin: string | null = PLATFORM) =>
	({
		tenant: { custom_domain: domain, slug },
		customDomains: { enabled: true, platformOrigin }
	}) satisfies LinkContext;

describe('orgHref', () => {
	it('turns SSR page-relative resolve() output into a root-relative path', () => {
		const org = { custom_domain: 'acme.example.com' };
		expect(orgHref(org, './events/acme/party', ON)).toBe(
			'https://acme.example.com/events/acme/party'
		);
		expect(orgHref(org, '../../org/acme?x=1', ON)).toBe('https://acme.example.com/org/acme?x=1');
		expect(orgHref(org, '.', ON)).toBe('https://acme.example.com/');
	});

	it('returns the relative path without a custom domain', () => {
		expect(orgHref({ custom_domain: null }, '/org/acme', ON)).toBe('/org/acme');
		expect(orgHref({}, '/org/acme', ON)).toBe('/org/acme');
		expect(orgHref(null, '/org/acme', ON)).toBe('/org/acme');
	});

	it('returns an absolute https link with a custom domain', () => {
		expect(orgHref({ custom_domain: 'events.example.com' }, '/events/acme/party?x=1#h', ON)).toBe(
			'https://events.example.com/events/acme/party?x=1#h'
		);
	});

	it('lowercases the domain', () => {
		expect(orgHref({ custom_domain: 'Events.Example.COM' }, '/', ON)).toBe(
			'https://events.example.com/'
		);
	});

	it('stays relative when already on that domain (case-insensitive)', () => {
		expect(
			orgHref({ custom_domain: 'events.example.com' }, '/org/acme', onTenant('EVENTS.example.com'))
		).toBe('/org/acme');
	});

	it('goes absolute when on a different tenant domain', () => {
		expect(orgHref({ custom_domain: 'a.example.com' }, '/x', onTenant('b.example.com'))).toBe(
			'https://a.example.com/x'
		);
	});

	it.each([
		'https://evil.com',
		'evil.com/path',
		'user@evil.com',
		'evil.com:8080',
		'evil com',
		'localhost',
		'-bad.example.com',
		'a..example.com',
		'ex_ample.com',
		''
	])('falls back to the relative path for malformed domain %j', (domain) => {
		expect(orgHref({ custom_domain: domain }, '/org/acme', ON)).toBe('/org/acme');
	});

	describe('tenant mode off', () => {
		const off: LinkContext = {
			tenant: null,
			customDomains: { enabled: false, platformOrigin: null }
		};
		it.each([[undefined], [null], [{}], [off]])('never rewrites (ctx %j)', (ctx) => {
			expect(orgHref({ custom_domain: 'events.example.com' }, '/org/acme', ctx)).toBe('/org/acme');
			expect(orgOrigin({ custom_domain: 'events.example.com' }, ctx)).toBeNull();
		});

		it('does not send tenant-host links to the platform either', () => {
			const ctx: LinkContext = {
				tenant: { custom_domain: 'a.example.com', slug: 'a' },
				customDomains: { enabled: false, platformOrigin: PLATFORM }
			};
			expect(orgHref({ custom_domain: null, slug: 'other' }, '/org/other', ctx)).toBe('/org/other');
		});
	});

	describe('org without a custom domain, viewed from a tenant host', () => {
		const other = { custom_domain: null, slug: 'other' };

		it('links to the platform origin, root-relative', () => {
			expect(orgHref(other, '/org/other', onTenant('a.example.com'))).toBe(`${PLATFORM}/org/other`);
			expect(orgHref(other, './events/other/party?x=1', onTenant('a.example.com'))).toBe(
				`${PLATFORM}/events/other/party?x=1`
			);
		});

		it('falls back to the relative path when the platform origin is unknown', () => {
			expect(orgHref(other, '/org/other', onTenant('a.example.com', 'acme', null))).toBe(
				'/org/other'
			);
		});

		it('keeps the tenant org itself relative even when its payload lacks the domain', () => {
			expect(
				orgHref({ custom_domain: null, slug: 'acme' }, '/org/acme', onTenant('a.example.com'))
			).toBe('/org/acme');
		});

		it('stays relative on the platform host', () => {
			expect(orgHref(other, '/org/other', ON)).toBe('/org/other');
		});
	});
});

describe('helpers', () => {
	it('normalizeCustomDomain / orgOrigin', () => {
		expect(normalizeCustomDomain(' Foo.Bar.io ')).toBe('foo.bar.io');
		expect(orgOrigin({ custom_domain: 'foo.bar.io' }, ON)).toBe('https://foo.bar.io');
		expect(orgOrigin({ custom_domain: null }, ON)).toBeNull();
	});

	it('rootRelative drops page-relative prefixes', () => {
		expect(rootRelative('./')).toBe('/');
		expect(rootRelative('../../org/x')).toBe('/org/x');
		expect(rootRelative('/org/x')).toBe('/org/x');
		expect(rootRelative('org/x')).toBe('/org/x');
	});
});
