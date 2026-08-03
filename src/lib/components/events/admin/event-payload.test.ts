import { describe, it, expect } from 'vitest';
import {
	buildEditorUpdateData,
	buildRecurringTemplateCreateData,
	buildWizardStep1UpdateData,
	buildWizardStep2UpdateData,
	type EventFormPayloadData
} from './event-payload';

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

	it('defaults require_ticket_names to true when unset', () => {
		const payload = buildRecurringTemplateCreateData({}, NAME, START_ISO, CITY_ID);

		expect(payload.require_ticket_names).toBe(true);
	});

	it('round-trips require_ticket_names false', () => {
		const formData: EventFormPayloadData = { require_ticket_names: false };

		const payload = buildRecurringTemplateCreateData(formData, NAME, START_ISO, CITY_ID);

		expect(payload.require_ticket_names).toBe(false);
	});

	it('maps the template form fields onto the create payload', () => {
		const formData: EventFormPayloadData = {
			visibility: 'private',
			event_type: 'members-only',
			description: '  Bring your own board games.  ',
			address: '  Somewhere 1  ',
			visibility_settings: {
				address_visibility: 'members-only',
				show_pronoun_distribution: true
			},
			max_attendees: 30,
			max_tickets_per_user: 2,
			waitlist_open: true,
			invitation_message: '',
			potluck_open: true,
			accept_invitation_requests: true,
			accept_rsvp_notes: true,
			can_attend_without_login: true,
			require_ticket_names: false,
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
			require_ticket_names: false,
			requires_full_profile: true,
			venue_id: 'venue-1',
			location_maps_url: 'https://maps.example/x',
			location_maps_embed: null,
			visibility_settings: {
				show_attendee_count: true,
				show_capacity: true,
				show_attendee_list: true,
				show_pronoun_distribution: true,
				address_visibility: 'members-only'
			}
		});

		expect(payload).not.toHaveProperty('address_visibility');
		expect(payload).not.toHaveProperty('public_pronoun_distribution');
	});
});

// #690 / backend #825 / #793. Three contract rules are load-bearing here:
//   - `visibility_settings` MERGES sub-key-wise, so a whole-object round-trip is
//     safe and an omitted field means "no change".
//   - `EventEditSchema` declares the field non-nullable → an explicit `null` is a
//     422. `TemplateEditSchema` accepts `null` as "no change". We never emit one.
//   - `extra="forbid"` → only the five known keys may be sent; preset names are
//     frontend-only, and the old flat `address_visibility` /
//     `public_pronoun_distribution` fields must never appear at the top level.
describe('visibility_settings write semantics', () => {
	const builders = {
		'wizard step 1': (f: EventFormPayloadData) => buildWizardStep1UpdateData(f),
		'wizard step 2': (f: EventFormPayloadData) => buildWizardStep2UpdateData(f),
		editor: (f: EventFormPayloadData) => buildEditorUpdateData(f, START_ISO),
		'recurring template': (f: EventFormPayloadData) =>
			buildRecurringTemplateCreateData(f, NAME, START_ISO, CITY_ID)
	};

	for (const [label, build] of Object.entries(builders)) {
		it(`${label}: omits the field entirely when the form never carried one`, () => {
			const payload = build({});

			expect(payload.visibility_settings).toBeUndefined();
			// `undefined` — never `null`, which EventEditSchema rejects with a 422.
			expect(payload.visibility_settings).not.toBeNull();
			expect(JSON.parse(JSON.stringify(payload))).not.toHaveProperty('visibility_settings');
		});

		it(`${label}: never sends address_visibility or public_pronoun_distribution at the top level`, () => {
			const payload = build({
				visibility_settings: { address_visibility: 'members-only', show_pronoun_distribution: true }
			});

			expect(payload).not.toHaveProperty('address_visibility');
			expect(payload).not.toHaveProperty('public_pronoun_distribution');
		});

		it(`${label}: round-trips all five resolved keys when the form carries one`, () => {
			const payload = build({ visibility_settings: { show_capacity: false } });

			expect(payload.visibility_settings).toEqual({
				show_attendee_count: true,
				show_capacity: false,
				show_attendee_list: true,
				show_pronoun_distribution: false,
				address_visibility: 'public'
			});
		});

		it(`${label}: sends nothing but the five known keys`, () => {
			const payload = build({
				visibility_settings: {
					show_attendee_count: false,
					show_capacity: false,
					show_attendee_list: false,
					show_pronoun_distribution: true,
					address_visibility: 'members-only'
				}
			});

			expect(Object.keys(payload.visibility_settings ?? {}).sort()).toEqual([
				'address_visibility',
				'show_attendee_count',
				'show_attendee_list',
				'show_capacity',
				'show_pronoun_distribution'
			]);
		});
	}
});

// #753. The backend default for `require_ticket_names` is `true`, so an unset
// form field must be written as an explicit `true` — NOT the `|| false` pattern
// the neighbouring flags use, which would silently opt every event out of
// collecting ticket-holder names.
describe('require_ticket_names write semantics', () => {
	const builders = {
		'wizard step 1': (f: EventFormPayloadData) => buildWizardStep1UpdateData(f),
		'wizard step 2': (f: EventFormPayloadData) => buildWizardStep2UpdateData(f),
		editor: (f: EventFormPayloadData) => buildEditorUpdateData(f, START_ISO),
		'recurring template': (f: EventFormPayloadData) =>
			buildRecurringTemplateCreateData(f, NAME, START_ISO, CITY_ID)
	};

	for (const [label, build] of Object.entries(builders)) {
		it(`${label}: defaults to true (backend default) when unset`, () => {
			expect(build({}).require_ticket_names).toBe(true);
		});

		it(`${label}: preserves an explicit false`, () => {
			expect(build({ require_ticket_names: false }).require_ticket_names).toBe(false);
		});
	}
});
