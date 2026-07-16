import { describe, it, expect } from 'vitest';
import { buildRecurringTemplateCreateData, type EventFormPayloadData } from './event-payload';

const NAME = 'Weekly Game Night';
const START_ISO = '2026-08-01T18:00:00+02:00';
const CITY_ID = 42;

describe('buildRecurringTemplateCreateData', () => {
	it('includes accept_rsvp_notes when the organizer enabled it', () => {
		const formData: EventFormPayloadData = { accept_rsvp_notes: true };

		const payload = buildRecurringTemplateCreateData(formData, NAME, START_ISO, CITY_ID);

		expect(payload.accept_rsvp_notes).toBe(true);
	});

	it('sends accept_rsvp_notes as explicit false when unset', () => {
		const payload = buildRecurringTemplateCreateData({}, NAME, START_ISO, CITY_ID);

		expect(payload.accept_rsvp_notes).toBe(false);
	});

	it('maps the template form fields onto the create payload', () => {
		const formData: EventFormPayloadData = {
			visibility: 'private',
			event_type: 'members-only',
			description: '  Bring your own board games.  ',
			address: '  Somewhere 1  ',
			address_visibility: 'members-only',
			max_attendees: 30,
			max_tickets_per_user: 2,
			waitlist_open: true,
			invitation_message: '',
			potluck_open: true,
			accept_invitation_requests: true,
			accept_rsvp_notes: true,
			can_attend_without_login: true,
			requires_full_profile: true,
			venue_id: 'venue-1',
			location_maps_url: 'https://maps.example/x',
			location_maps_embed: null
		};

		const payload = buildRecurringTemplateCreateData(formData, NAME, START_ISO, CITY_ID);

		expect(payload).toEqual({
			name: NAME,
			start: START_ISO,
			city_id: CITY_ID,
			visibility: 'private',
			event_type: 'members-only',
			end: null,
			description: 'Bring your own board games.',
			address: 'Somewhere 1',
			address_visibility: 'members-only',
			rsvp_before: null,
			max_attendees: 30,
			max_tickets_per_user: 2,
			waitlist_open: true,
			invitation_message: null,
			check_in_starts_at: null,
			check_in_ends_at: null,
			potluck_open: true,
			accept_invitation_requests: true,
			accept_rsvp_notes: true,
			apply_before: null,
			can_attend_without_login: true,
			requires_full_profile: true,
			venue_id: 'venue-1',
			location_maps_url: 'https://maps.example/x',
			location_maps_embed: null
		});
	});
});
