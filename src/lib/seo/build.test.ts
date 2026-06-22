// src/lib/seo/build.test.ts
import { describe, it, expect } from 'vitest';
import { buildSeo } from '$lib/seo/build';
import type { EventDetailSchema } from '$lib/api/generated/types.gen';

const url = (path: string) => new URL(`https://letsrevel.io${path}`);

const fakeEvent = {
	id: 'e1',
	name: 'My Event',
	slug: 'my-event',
	description: 'desc',
	start: '2026-07-01T18:00:00Z',
	end: '2026-07-01T23:00:00Z',
	status: 'scheduled',
	requires_ticket: false,
	max_attendees: 0,
	attendee_count: 0,
	rsvp_before: null,
	address: null,
	city: null,
	logo: null,
	cover_art: null,
	event_series: null,
	organization: { id: 'o1', name: 'Acme', slug: 'acme', logo: null, cover_art: null }
} as unknown as EventDetailSchema;

describe('buildSeo', () => {
	it('home: emits WebSite + Org JSON-LD and same-URL hreflang', () => {
		const cfg = buildSeo({ kind: 'home', url: url('/'), lang: 'en' });
		expect(cfg.canonical).toBe('https://letsrevel.io/');
		expect(cfg.og.locale).toBe('en_US');
		expect(cfg.og.localeAlternate).toEqual(['de_DE', 'it_IT', 'fr_FR']);
		expect(cfg.hreflang.map((h) => h.lang)).toEqual(['en', 'de', 'it', 'fr', 'x-default']);
		expect(cfg.hreflang.every((h) => h.href === 'https://letsrevel.io/')).toBe(true);
		expect(cfg.jsonLd.some((j: any) => j['@type'] === 'WebSite')).toBe(true);
		expect(cfg.robots).toBeUndefined();
	});

	it('event indexable: includes Event + Breadcrumb JSON-LD; no robots tag', () => {
		const cfg = buildSeo({
			kind: 'event',
			url: url('/events/acme/my-event'),
			lang: 'en',
			event: fakeEvent,
			indexable: true
		});
		expect(cfg.title).toContain('My Event');
		expect(cfg.canonical).toBe('https://letsrevel.io/events/acme/my-event');
		expect(cfg.robots).toBeUndefined();
		const types = cfg.jsonLd.map((j: any) => j['@type']);
		expect(types).toContain('Event');
		expect(types).toContain('BreadcrumbList');
	});

	it('event non-indexable: emits noindex,follow', () => {
		const cfg = buildSeo({
			kind: 'event',
			url: url('/events/acme/my-event'),
			lang: 'en',
			event: fakeEvent,
			indexable: false
		});
		expect(cfg.robots).toBe('noindex,follow');
	});

	it('landing: hreflang uses per-locale URLs, not same-URL', () => {
		const cfg = buildSeo({
			kind: 'landing',
			url: url('/de/eventbrite-alternative'),
			lang: 'de',
			slug: 'eventbrite-alternative'
		});
		const map = Object.fromEntries(cfg.hreflang.map((h) => [h.lang, h.href]));
		expect(map.en).toBe('https://letsrevel.io/eventbrite-alternative');
		expect(map.de).toBe('https://letsrevel.io/de/eventbrite-alternative');
		expect(map.it).toBe('https://letsrevel.io/it/eventbrite-alternative');
		expect(map['x-default']).toBe('https://letsrevel.io/eventbrite-alternative');
	});

	it('auth pages emit noindex,follow', () => {
		const cfg = buildSeo({
			kind: 'auth',
			url: url('/login'),
			lang: 'en',
			page: 'login'
		});
		expect(cfg.robots).toBe('noindex,follow');
	});
});
