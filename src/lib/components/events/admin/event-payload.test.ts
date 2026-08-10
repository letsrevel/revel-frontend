import { describe, it, expect } from 'vitest';
import {
	buildEditorUpdateData,
	buildEventCreateData,
	buildRecurringTemplateCreateData,
	buildWizardStep1UpdateData,
	buildWizardStep2UpdateData,
	type EventFormPayloadData
} from './event-payload';
import { toISOString } from '$lib/utils/datetime';

const NAME = 'Weekly Game Night';
const START_ISO = '2026-08-01T18:00:00+02:00';
const CITY_ID = 42;

// The `datetime-local` value the organizer types, and the ISO string the
// builders must derive from it. Resolved through the same helper the builders
// use so the expectation stays correct under any machine timezone — what is
// asserted here is that the field survives into the payload at all.
const END_LOCAL = '2026-08-01T22:00';
const END_ISO = toISOString(END_LOCAL);

// #813. The create payload is the ONLY write for an organizer who fills in the
// essentials, hits "Create", and navigates away — anything the form collects but
// the builder drops is silently replaced by a backend default and never
// repaired. `end` was dropped, and `Event.save()` sets `end = start + 1 day`
// when it is falsy, so every abandoned draft became a 24-hour event.
describe('buildEventCreateData', () => {
	// Every field EssentialsStep (the pre-creation form) collects, plus the
	// create-mode seeds EventEditor applies before the first POST.
	const formData: EventFormPayloadData = {
		name: NAME,
		start: '2026-08-01T18:00',
		end: END_LOCAL,
		is_open_ended: false,
		city_id: CITY_ID,
		visibility: 'private',
		event_type: 'members-only',
		requires_ticket: true,
		requires_full_profile: true,
		accept_rsvp_notes: true,
		event_series_id: 'series-1',
		venue_id: 'venue-1'
	};

	it('carries every field the create form collects into the POST body', () => {
		const payload = buildEventCreateData(formData, NAME, START_ISO);

		expect(payload).toEqual({
			name: NAME,
			start: START_ISO,
			end: END_ISO,
			is_open_ended: false,
			city_id: CITY_ID,
			visibility: 'private',
			event_type: 'members-only',
			status: 'draft',
			requires_ticket: true,
			requires_full_profile: true,
			accept_rsvp_notes: true,
			event_series_id: 'series-1',
			venue_id: 'venue-1'
		});
	});

	it('sends the typed end so the backend does not default it to start + 24h', () => {
		const payload = buildEventCreateData(formData, NAME, START_ISO);

		expect(payload.end).toBe(END_ISO);
		expect(payload.end).toContain('2026-08-01T22:00:00');
		expect(payload.end).not.toBeNull();
		expect(JSON.parse(JSON.stringify(payload))).toHaveProperty('end');
	});

	it('sends end as null and the flag as true for an open-ended event', () => {
		const payload = buildEventCreateData({ ...formData, is_open_ended: true }, NAME, START_ISO);

		expect(payload.end).toBeNull();
		expect(payload.is_open_ended).toBe(true);
	});

	it('sends is_open_ended as an explicit false when the form never set it', () => {
		const payload = buildEventCreateData({}, NAME, START_ISO);

		expect(payload.is_open_ended).toBe(false);
		expect(payload.end).toBeNull();
	});

	it('omits no field that the wizard/editor update payloads write back', () => {
		const created = buildEventCreateData(formData, NAME, START_ISO);
		const updated = buildEditorUpdateData(formData, START_ISO);

		// Every key the create payload sends must round-trip identically through
		// the first "Save" — a create/update disagreement is exactly the #813 bug.
		for (const key of Object.keys(created) as (keyof typeof created)[]) {
			if (key === 'status' || key === 'requires_ticket') continue; // create-only
			expect([key, created[key]]).toEqual([key, updated[key as keyof typeof updated]]);
		}
	});
});

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
			is_virtual: false,
			vat_country_code: '',
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

// #830 (BE #869). Event save is a full-replacement PUT and both place-of-supply
// fields have non-null backend defaults (`false` / `""`): an update builder
// that omits them silently un-virtualizes the event and clears the VAT-country
// override on every unrelated save.
describe('place-of-supply write semantics (is_virtual / vat_country_code)', () => {
	const builders = {
		'wizard step 1': (f: EventFormPayloadData) => buildWizardStep1UpdateData(f),
		'wizard step 2': (f: EventFormPayloadData) => buildWizardStep2UpdateData(f),
		editor: (f: EventFormPayloadData) => buildEditorUpdateData(f, START_ISO),
		'recurring template': (f: EventFormPayloadData) =>
			buildRecurringTemplateCreateData(f, NAME, START_ISO, CITY_ID)
	};

	for (const [label, build] of Object.entries(builders)) {
		it(`${label}: sends explicit defaults when the form never set them`, () => {
			const payload = build({});
			expect(payload.is_virtual).toBe(false);
			expect(payload.vat_country_code).toBe('');
		});

		it(`${label}: round-trips a virtual event with a VAT-country override`, () => {
			const payload = build({ is_virtual: true, vat_country_code: 'DE' });
			expect(payload.is_virtual).toBe(true);
			expect(payload.vat_country_code).toBe('DE');
		});
	}
});
