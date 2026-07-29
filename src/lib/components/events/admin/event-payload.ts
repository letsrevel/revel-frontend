import type {
	EventCreateSchema,
	EventEditSchema,
	EventVisibilitySettings,
	ResourceVisibility
} from '$lib/api/generated/types.gen';
import { toISOString } from '$lib/utils/datetime';
import { resolveVisibilitySettings } from '$lib/utils/event-visibility';

/**
 * Shape of the wizard/editor `formData` reactive object, as far as the payload
 * builders below read from it. Both EventWizard and EventEditor pass their
 * (structurally wider) `formData` here.
 */
export type EventFormPayloadData = Partial<EventCreateSchema> & {
	tags?: string[];
	requires_ticket?: boolean;
	address_visibility?: ResourceVisibility;
	venue_id?: string | null;
	location_maps_url?: string | null;
	location_maps_embed?: string | null;
	public_pronoun_distribution?: boolean;
};

/**
 * The `visibility_settings` value to write, or `undefined` to omit the field.
 *
 * Three rules from backend #825, all satisfied by this one helper:
 *
 * 1. The backend **merges** this object at sub-key granularity — omitting a
 *    toggle means "no change", so both a whole-object round-trip and a partial
 *    write are correct. We round-trip the resolved triple, which keeps the
 *    payload honest even when the user edited only one toggle.
 * 2. Explicit `null` is a 422 against `EventEditSchema` (it is declared
 *    non-nullable there, unlike `TemplateEditSchema`). We never emit `null`:
 *    the field is either a concrete object or absent, which is valid against
 *    both schemas.
 * 3. `extra="forbid"` — only the three known toggles are ever sent; preset
 *    names live entirely in the UI.
 *
 * Returning `undefined` (rather than the all-`true` default) matters: a create
 * flow that never opened the visibility section must not assert a disclosure
 * choice, and an edit whose `formData` was never seeded must not silently
 * re-disclose a count the organizer had hidden.
 */
function visibilitySettingsForWrite(
	formData: EventFormPayloadData
): EventVisibilitySettings | undefined {
	return formData.visibility_settings
		? resolveVisibilitySettings(formData.visibility_settings)
		: undefined;
}

/**
 * Build the create-event payload (essential fields only). Identical between
 * EventWizard and EventEditor. `name`/`startIso` are passed explicitly because
 * callers validate them (non-null) before invoking.
 */
export function buildEventCreateData(
	formData: EventFormPayloadData,
	name: string,
	startIso: string
): EventCreateSchema {
	return {
		name,
		start: startIso,
		city_id: formData.city_id,
		visibility: formData.visibility || 'public',
		event_type: formData.event_type || 'public',
		status: 'draft', // Create as draft by default
		requires_ticket: formData.requires_ticket || false, // Send explicit false when unchecked
		requires_full_profile: formData.requires_full_profile || false,
		accept_rsvp_notes: formData.accept_rsvp_notes || false,
		venue_id: formData.venue_id || null
	};
}

/**
 * Build the event-template payload for RecurringEventWizard's create flow.
 * Unlike `buildEventCreateData` (draft essentials only), the recurring wizard
 * submits the full template in one shot, so every DetailsStep-driven field must
 * be echoed here — an omitted optional boolean silently falls back to the
 * backend default. `name`/`startIso`/`cityId` are passed explicitly because the
 * caller validates them (non-null) before invoking.
 */
export function buildRecurringTemplateCreateData(
	formData: EventFormPayloadData,
	name: string,
	startIso: string,
	cityId: number
): EventCreateSchema {
	return {
		name,
		start: startIso,
		city_id: cityId,
		visibility: formData.visibility ?? 'public',
		event_type: formData.event_type ?? 'public',
		end: toISOString(formData.end),
		description: formData.description?.trim() || null,
		address: formData.address?.trim() || null,
		address_visibility: formData.address_visibility ?? 'public',
		rsvp_before: toISOString(formData.rsvp_before),
		max_attendees: formData.max_attendees || undefined,
		max_tickets_per_user: formData.max_tickets_per_user ?? 1,
		waitlist_open: formData.waitlist_open ?? false,
		invitation_message: formData.invitation_message?.trim() || null,
		check_in_starts_at: toISOString(formData.check_in_starts_at),
		check_in_ends_at: toISOString(formData.check_in_ends_at),
		potluck_open: formData.potluck_open ?? false,
		accept_invitation_requests: formData.accept_invitation_requests ?? false,
		accept_rsvp_notes: formData.accept_rsvp_notes ?? false,
		apply_before: toISOString(formData.apply_before),
		can_attend_without_login: formData.can_attend_without_login ?? false,
		requires_full_profile: formData.requires_full_profile ?? false,
		venue_id: formData.venue_id ?? null,
		location_maps_url: formData.location_maps_url ?? null,
		location_maps_embed: formData.location_maps_embed ?? null,
		visibility_settings: visibilitySettingsForWrite(formData)
	};
}

/**
 * Build the full update payload for EventWizard Step 1 (Essentials submit while
 * editing an existing event). MUST include ALL fields because the backend uses
 * PUT (full replacement).
 */
export function buildWizardStep1UpdateData(
	formData: EventFormPayloadData
): Partial<EventEditSchema> {
	return {
		name: formData.name,
		start: toISOString(formData.start),
		city_id: formData.city_id,
		visibility: formData.visibility || 'public',
		event_type: formData.event_type || 'public',
		// Include all other fields to prevent them from being reset
		description: formData.description || null,
		end: formData.is_open_ended ? null : toISOString(formData.end),
		is_open_ended: formData.is_open_ended ?? false,
		address: formData.address || null,
		address_visibility: formData.address_visibility || 'public',
		rsvp_before: toISOString(formData.rsvp_before),
		max_attendees: formData.max_attendees || undefined,
		max_tickets_per_user: formData.max_tickets_per_user ?? 1,
		waitlist_open: formData.waitlist_open || false,
		invitation_message: formData.invitation_message || null,
		check_in_starts_at: toISOString(formData.check_in_starts_at),
		check_in_ends_at: toISOString(formData.check_in_ends_at),
		potluck_open: formData.potluck_open || false,
		accept_invitation_requests: formData.accept_invitation_requests || false,
		accept_rsvp_notes: formData.accept_rsvp_notes || false,
		apply_before: toISOString(formData.apply_before),
		can_attend_without_login: formData.can_attend_without_login || false,
		requires_full_profile: formData.requires_full_profile || false,
		event_series_id: formData.event_series_id || null,
		venue_id: formData.venue_id || null,
		location_maps_url: formData.location_maps_url || null,
		location_maps_embed: formData.location_maps_embed || null,
		visibility_settings: visibilitySettingsForWrite(formData)
	};
}

/**
 * Build the Step 2 (Details) update payload for EventWizard. Excludes
 * name/start/visibility/event_type (those are owned by Step 1).
 */
export function buildWizardStep2UpdateData(
	formData: EventFormPayloadData
): Partial<EventEditSchema> {
	return {
		city_id: formData.city_id, // Now required from LocationSection
		description: formData.description || null,
		end: formData.is_open_ended ? null : toISOString(formData.end),
		is_open_ended: formData.is_open_ended ?? false,
		address: formData.address || null,
		address_visibility: formData.address_visibility || 'public',
		rsvp_before: toISOString(formData.rsvp_before),
		max_attendees: formData.max_attendees || undefined,
		max_tickets_per_user: formData.max_tickets_per_user ?? 1,
		waitlist_open: formData.waitlist_open || false,
		invitation_message: formData.invitation_message || null,
		check_in_starts_at: toISOString(formData.check_in_starts_at),
		check_in_ends_at: toISOString(formData.check_in_ends_at),
		potluck_open: formData.potluck_open || false,
		accept_invitation_requests: formData.accept_invitation_requests || false,
		accept_rsvp_notes: formData.accept_rsvp_notes || false,
		apply_before: toISOString(formData.apply_before),
		can_attend_without_login: formData.can_attend_without_login || false,
		requires_full_profile: formData.requires_full_profile || false,
		event_series_id: formData.event_series_id || null,
		venue_id: formData.venue_id || null,
		location_maps_url: formData.location_maps_url || null,
		location_maps_embed: formData.location_maps_embed || null,
		visibility_settings: visibilitySettingsForWrite(formData)
	};
}

/**
 * Build the unified update payload for EventEditor's `handleSave`. Like the
 * wizard Step 1 payload but additionally carries `public_pronoun_distribution`
 * (an EventEditor-only field). `startIso` is passed explicitly because the
 * caller validates it (non-null) beforehand.
 */
export function buildEditorUpdateData(
	formData: EventFormPayloadData,
	startIso: string
): Partial<EventEditSchema> {
	return {
		name: formData.name,
		start: startIso,
		city_id: formData.city_id,
		visibility: formData.visibility || 'public',
		event_type: formData.event_type || 'public',
		description: formData.description || null,
		end: formData.is_open_ended ? null : toISOString(formData.end),
		is_open_ended: formData.is_open_ended ?? false,
		address: formData.address || null,
		address_visibility: formData.address_visibility || 'public',
		rsvp_before: toISOString(formData.rsvp_before),
		max_attendees: formData.max_attendees || undefined,
		max_tickets_per_user: formData.max_tickets_per_user ?? 1,
		waitlist_open: formData.waitlist_open || false,
		invitation_message: formData.invitation_message || null,
		check_in_starts_at: toISOString(formData.check_in_starts_at),
		check_in_ends_at: toISOString(formData.check_in_ends_at),
		potluck_open: formData.potluck_open || false,
		accept_invitation_requests: formData.accept_invitation_requests || false,
		accept_rsvp_notes: formData.accept_rsvp_notes || false,
		public_pronoun_distribution: formData.public_pronoun_distribution || false,
		apply_before: toISOString(formData.apply_before),
		can_attend_without_login: formData.can_attend_without_login || false,
		requires_full_profile: formData.requires_full_profile || false,
		event_series_id: formData.event_series_id || null,
		venue_id: formData.venue_id || null,
		location_maps_url: formData.location_maps_url || null,
		location_maps_embed: formData.location_maps_embed || null,
		visibility_settings: visibilitySettingsForWrite(formData)
	};
}
