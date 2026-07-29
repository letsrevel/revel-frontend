import { describe, it, expect } from 'vitest';
import {
	buildOembedIframeHtml,
	clampOembedSize,
	escapeHtmlAttribute,
	parseOembedDimension,
	oembedDiscoveryUrl,
	resolveOembedTarget
} from './oembed';

const ORIGIN = 'https://letsrevel.io';
const resolve = (href: string, origin = ORIGIN) => resolveOembedTarget(new URL(href), origin);

describe('resolveOembedTarget', () => {
	it('maps an event page onto the event embed', () => {
		expect(resolve(`${ORIGIN}/events/acme/summer-party`)).toEqual({
			kind: 'event',
			orgSlug: 'acme',
			resourceSlug: 'summer-party',
			embedPath: '/embed/acme/event/summer-party'
		});
	});

	it('maps a series page onto the series embed', () => {
		expect(resolve(`${ORIGIN}/events/acme/series/friday-nights`)).toEqual({
			kind: 'series',
			orgSlug: 'acme',
			resourceSlug: 'friday-nights',
			embedPath: '/embed/acme/series/friday-nights'
		});
	});

	it('maps an organization page onto the list embed', () => {
		expect(resolve(`${ORIGIN}/org/acme`)).toEqual({
			kind: 'list',
			orgSlug: 'acme',
			resourceSlug: null,
			embedPath: '/embed/acme'
		});
	});

	it('ignores the query string and trailing noise', () => {
		expect(resolve(`${ORIGIN}/events/acme/summer-party?utm_source=x#top`)?.kind).toBe('event');
	});

	it('refuses a foreign origin — oEmbed must not proxy other sites', () => {
		expect(resolve('https://evil.example/events/acme/summer-party')).toBeNull();
		expect(resolve(`http://letsrevel.io/org/acme`)).toBeNull();
	});

	it('returns null for malformed percent-encoding instead of throwing', () => {
		// `new URL()` accepts these; decodeURIComponent throws URIError on them.
		// The route must answer 404, not 500.
		expect(() => resolve(`${ORIGIN}/%`)).not.toThrow();
		expect(resolve(`${ORIGIN}/%`)).toBeNull();
		expect(resolve(`${ORIGIN}/events/acme/%E0%A4%A`)).toBeNull();
	});

	it('refuses paths that are not embeddable surfaces', () => {
		expect(resolve(`${ORIGIN}/`)).toBeNull();
		expect(resolve(`${ORIGIN}/events`)).toBeNull();
		expect(resolve(`${ORIGIN}/events/some-uuid`)).toBeNull();
		expect(resolve(`${ORIGIN}/events/acme/summer-party/questionnaire/1`)).toBeNull();
		expect(resolve(`${ORIGIN}/dashboard`)).toBeNull();
		expect(resolve(`${ORIGIN}/org/acme/resources`)).toBeNull();
	});

	it('embeds an event whose slug is literally "series"', () => {
		// /events/{org}/series routes to the event page (the series route needs a
		// fourth segment), so oEmbed must not reject it.
		expect(resolve(`${ORIGIN}/events/acme/series`)).toEqual({
			kind: 'event',
			orgSlug: 'acme',
			resourceSlug: 'series',
			embedPath: '/embed/acme/event/series'
		});
	});

	it('percent-encodes slugs back into the embed path', () => {
		expect(resolve(`${ORIGIN}/org/a%20b`)?.embedPath).toBe('/embed/a%20b');
	});
});

describe('parseOembedDimension', () => {
	it('accepts positive integers and caps absurd values', () => {
		expect(parseOembedDimension('600')).toBe(600);
		expect(parseOembedDimension('99999')).toBe(5000);
	});

	it('rejects junk', () => {
		expect(parseOembedDimension(null)).toBeNull();
		expect(parseOembedDimension('')).toBeNull();
		expect(parseOembedDimension('0')).toBeNull();
		expect(parseOembedDimension('-10')).toBeNull();
		expect(parseOembedDimension('12.5')).toBeNull();
		expect(parseOembedDimension('wide')).toBeNull();
	});
});

describe('clampOembedSize', () => {
	it('returns the surface default when unconstrained', () => {
		expect(clampOembedSize('event', null, null)).toEqual({ width: 600, height: 460 });
		expect(clampOembedSize('list', null, null)).toEqual({ width: 600, height: 820 });
	});

	it('scales the height with the width instead of cropping', () => {
		expect(clampOembedSize('event', 300, null)).toEqual({ width: 300, height: 230 });
	});

	it('never exceeds maxheight', () => {
		expect(clampOembedSize('list', null, 400).height).toBe(400);
	});

	it('never grows beyond the default for a generous maxwidth', () => {
		expect(clampOembedSize('event', 5000, null).width).toBe(600);
	});

	it('scales the width too when maxheight is the binding constraint', () => {
		// 400/820 -> both axes shrink together; clamping height alone would give
		// 600x400, a squashed box whose content the scroll-less iframe crops.
		expect(clampOembedSize('list', null, 400)).toEqual({ width: 293, height: 400 });
	});

	it('honours whichever of the two limits binds harder', () => {
		expect(clampOembedSize('list', 300, 800)).toEqual({ width: 300, height: 410 });
	});
});

describe('escapeHtmlAttribute', () => {
	it('neutralises attribute-breaking characters', () => {
		expect(escapeHtmlAttribute(`a"b<c>d&e'f`)).toBe('a&quot;b&lt;c&gt;d&amp;e&#39;f');
	});
});

describe('buildOembedIframeHtml', () => {
	it('escapes the title and src it is handed', () => {
		const html = buildOembedIframeHtml({
			src: 'https://letsrevel.io/embed/acme?a=1&b=2',
			width: 600,
			height: 460,
			title: 'Rock & Roll "Night"'
		});

		expect(html).toContain('src="https://letsrevel.io/embed/acme?a=1&amp;b=2"');
		expect(html).toContain('title="Rock &amp; Roll &quot;Night&quot;"');
		expect(html).not.toContain('"Night"');
		expect(html).toContain('width="600"');
		expect(html).toContain('height="460"');
		expect(html).toContain('loading="lazy"');
	});
});

describe('oembedDiscoveryUrl', () => {
	it('points a consumer at our endpoint for the clean page URL', () => {
		expect(oembedDiscoveryUrl(new URL('https://letsrevel.io/events/acme/summer-party'))).toBe(
			'https://letsrevel.io/oembed?url=https%3A%2F%2Fletsrevel.io%2Fevents%2Facme%2Fsummer-party&format=json'
		);
	});

	it('strips the query string, so invitation tokens are never published', () => {
		const url = new URL('https://letsrevel.io/events/acme/summer-party?et=secret-token');
		expect(oembedDiscoveryUrl(url)).not.toContain('secret-token');
	});
});
