import { describe, it, expect } from 'vitest';
import { generateEventJsonLd } from '$lib/seo/jsonld/event';
import type { EventDetailSchema } from '$lib/api/generated/types.gen';

const baseEvent = {
	id: 'evt-1',
	name: 'Summer Festival',
	slug: 'summer-festival',
	description: 'A nice festival',
	start: '2026-07-01T18:00:00Z',
	end: '2026-07-01T23:00:00Z',
	status: 'scheduled',
	requires_ticket: false,
	max_attendees: 0,
	attendee_count: 10,
	rsvp_before: null,
	address: '10 Main St',
	city: { name: 'Berlin', country: 'DE' },
	logo: null,
	cover_art: null,
	event_series: null,
	organization: { id: 'org-1', name: 'Acme', slug: 'acme', logo: null, cover_art: null }
} as unknown as EventDetailSchema;

describe('generateEventJsonLd', () => {
	it('returns a schema.org Event with required fields', () => {
		const ld = generateEventJsonLd(baseEvent, 'https://letsrevel.io/events/acme/summer-festival');
		expect(ld['@context']).toBe('https://schema.org');
		expect(ld['@type']).toBe('Event');
		expect(ld.name).toBe('Summer Festival');
		expect(ld.startDate).toBe('2026-07-01T18:00:00Z');
		expect(ld.eventStatus).toBe('https://schema.org/EventScheduled');
		expect(ld.eventAttendanceMode).toBe('https://schema.org/OfflineEventAttendanceMode');
	});

	it('falls back to current date when start is missing', () => {
		const e = { ...baseEvent, start: null } as unknown as EventDetailSchema;
		const ld = generateEventJsonLd(e, 'https://example.test/x');
		expect(ld.startDate).toMatch(/^\d{4}-\d{2}-\d{2}T/);
	});

	it('emits a free Offer when event does not require a ticket', () => {
		const ld = generateEventJsonLd(baseEvent, 'https://letsrevel.io/x');
		expect(ld.offers).toBeDefined();
		expect(ld.offers?.price).toBe('0');
		expect(ld.offers?.availability).toBe('https://schema.org/InStock');
	});

	// #690: availability comes from the always-public `is_full` (#825). Deriving
	// it from `max_attendees`/`attendee_count` published "InStock" for a discreet
	// event that was actually sold out.
	it('marks the Offer SoldOut when the backend flags the event as full', () => {
		const e = { ...baseEvent, is_full: true } as EventDetailSchema;
		const ld = generateEventJsonLd(e, 'https://letsrevel.io/x');
		expect(ld.offers?.availability).toBe('https://schema.org/SoldOut');
	});

	it('marks the Offer SoldOut even when capacity and count are withheld', () => {
		const e = {
			...baseEvent,
			is_full: true,
			max_attendees: null,
			attendee_count: null
		} as EventDetailSchema;
		const ld = generateEventJsonLd(e, 'https://letsrevel.io/x');
		expect(ld.offers?.availability).toBe('https://schema.org/SoldOut');
	});

	it('stays InStock when the flag is false, whatever the numbers say', () => {
		const e = {
			...baseEvent,
			is_full: false,
			max_attendees: 10,
			attendee_count: 10
		} as EventDetailSchema;
		const ld = generateEventJsonLd(e, 'https://letsrevel.io/x');
		expect(ld.offers?.availability).toBe('https://schema.org/InStock');
	});

	it('stays InStock when the flag is absent', () => {
		const e = { ...baseEvent, is_full: undefined } as EventDetailSchema;
		const ld = generateEventJsonLd(e, 'https://letsrevel.io/x');
		expect(ld.offers?.availability).toBe('https://schema.org/InStock');
	});
});
