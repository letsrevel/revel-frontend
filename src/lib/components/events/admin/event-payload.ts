import type {
	EventCreateSchema,
	EventEditSchema,
	ResourceVisibility
} from '$lib/api/generated/types.gen';
import { toISOString } from '$lib/utils/datetime';

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
		location_maps_embed: formData.location_maps_embed || null
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
		location_maps_embed: formData.location_maps_embed || null
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
		location_maps_embed: formData.location_maps_embed || null
	};
}
