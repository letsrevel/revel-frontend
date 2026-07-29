import { describe, it, expect } from 'vitest';
import { buildEmbedLink, eventPath, organizationPath, poweredByLink, seriesPath } from './links';

const ORIGIN = 'https://letsrevel.io';

describe('buildEmbedLink', () => {
	it('stamps the full attribution convention', () => {
		const url = new URL(
			buildEmbedLink(ORIGIN, '/events/acme/summer-party', {
				medium: 'list',
				campaign: 'acme',
				content: 'example.com'
			})
		);

		expect(url.origin).toBe(ORIGIN);
		expect(url.pathname).toBe('/events/acme/summer-party');
		expect(url.searchParams.get('utm_source')).toBe('embed');
		expect(url.searchParams.get('utm_medium')).toBe('list');
		expect(url.searchParams.get('utm_campaign')).toBe('acme');
		expect(url.searchParams.get('utm_content')).toBe('example.com');
	});

	it('omits utm_content when the host page is unknown', () => {
		const url = new URL(
			buildEmbedLink(ORIGIN, '/org/acme', { medium: 'oembed', campaign: 'acme' })
		);
		expect(url.searchParams.has('utm_content')).toBe(false);
		expect(url.searchParams.get('utm_medium')).toBe('oembed');
	});

	it('keeps the embed origin even for a path that looks absolute', () => {
		const url = new URL(
			buildEmbedLink('http://localhost:5173', '/org/acme', { medium: 'list', campaign: 'acme' })
		);
		expect(url.origin).toBe('http://localhost:5173');
	});
});

describe('path builders', () => {
	it('builds app paths', () => {
		expect(eventPath('acme', 'summer-party')).toBe('/events/acme/summer-party');
		expect(seriesPath('acme', 'friday-nights')).toBe('/events/acme/series/friday-nights');
		expect(organizationPath('acme')).toBe('/org/acme');
	});

	it('encodes slugs so a hostile slug cannot inject path segments', () => {
		expect(eventPath('acme', '../../admin')).toBe('/events/acme/..%2F..%2Fadmin');
		expect(organizationPath('a b')).toBe('/org/a%20b');
	});
});

describe('poweredByLink', () => {
	it('points at the site root with attribution intact', () => {
		const url = new URL(poweredByLink(ORIGIN, { medium: 'event', campaign: 'acme' }));
		expect(url.pathname).toBe('/');
		expect(url.searchParams.get('utm_source')).toBe('embed');
		expect(url.searchParams.get('utm_medium')).toBe('event');
	});
});
