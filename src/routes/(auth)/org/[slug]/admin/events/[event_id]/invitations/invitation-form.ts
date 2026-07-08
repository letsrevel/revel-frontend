/**
 * Form-data parsing helpers for the event invitations admin page actions.
 *
 * The create/update/bulk-update actions all read the same set of invitation
 * "waiver" options from the submitted form. This helper parses them into the
 * exact API request-body fragment those actions spread, keeping the parsing in
 * one place.
 */

/** The shared invitation-options fragment of a create/update request body. */
export interface InvitationOptions {
	custom_message: string | undefined;
	waives_questionnaire: boolean;
	waives_purchase: boolean;
	overrides_max_attendees: boolean;
	waives_membership_required: boolean;
	waives_rsvp_deadline: boolean;
	tier_ids: string[];
}

/**
 * Parse the shared invitation options (waivers, custom message, tier ids) from
 * submitted form data.
 *
 * Note: `tier_ids` is JSON-parsed exactly as the actions did inline — a
 * malformed value throws here, matching the previous behavior.
 */
export function parseInvitationOptions(formData: FormData): InvitationOptions {
	const customMessage = (formData.get('custom_message') as string | null) || null;
	const tierIdsRaw = formData.get('tier_ids') as string | null;
	const tierIds: string[] = tierIdsRaw ? JSON.parse(tierIdsRaw) : [];

	return {
		custom_message: customMessage ?? undefined,
		waives_questionnaire: formData.get('waives_questionnaire') === 'true',
		waives_purchase: formData.get('waives_purchase') === 'true',
		overrides_max_attendees: formData.get('overrides_max_attendees') === 'true',
		waives_membership_required: formData.get('waives_membership_required') === 'true',
		waives_rsvp_deadline: formData.get('waives_rsvp_deadline') === 'true',
		tier_ids: tierIds
	};
}
