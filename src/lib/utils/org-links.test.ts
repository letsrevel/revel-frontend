import { describe, expect, it } from 'vitest';
import { normalizeCustomDomain, orgHref, orgOrigin, tenantDomainFrom } from './org-links';

describe('orgHref', () => {
	it('returns the relative path without a custom domain', () => {
		expect(orgHref({ custom_domain: null }, '/org/acme')).toBe('/org/acme');
		expect(orgHref({}, '/org/acme')).toBe('/org/acme');
		expect(orgHref(null, '/org/acme')).toBe('/org/acme');
	});

	it('returns an absolute https link with a custom domain', () => {
		expect(orgHref({ custom_domain: 'events.example.com' }, '/events/acme/party?x=1#h')).toBe(
			'https://events.example.com/events/acme/party?x=1#h'
		);
	});

	it('lowercases the domain', () => {
		expect(orgHref({ custom_domain: 'Events.Example.COM' }, '/')).toBe(
			'https://events.example.com/'
		);
	});

	it('stays relative when already on that domain (case-insensitive)', () => {
		expect(
			orgHref({ custom_domain: 'events.example.com' }, '/org/acme', 'EVENTS.example.com')
		).toBe('/org/acme');
	});

	it('goes absolute when on a different tenant domain', () => {
		expect(orgHref({ custom_domain: 'a.example.com' }, '/x', 'b.example.com')).toBe(
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
		expect(orgHref({ custom_domain: domain }, '/org/acme')).toBe('/org/acme');
	});
});

describe('helpers', () => {
	it('normalizeCustomDomain / orgOrigin', () => {
		expect(normalizeCustomDomain(' Foo.Bar.io ')).toBe('foo.bar.io');
		expect(orgOrigin({ custom_domain: 'foo.bar.io' })).toBe('https://foo.bar.io');
		expect(orgOrigin({ custom_domain: null })).toBeNull();
	});
	it('tenantDomainFrom reads page data', () => {
		expect(tenantDomainFrom({ tenant: { custom_domain: 'a.b.io' } })).toBe('a.b.io');
		expect(tenantDomainFrom({ tenant: null })).toBeNull();
		expect(tenantDomainFrom({})).toBeNull();
	});
});
