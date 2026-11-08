import { extractFieldErrors } from '$lib/utils/errors';

/**
 * Ticket-tier "Grants membership" rules (BE epic #1317, `TicketTier.clean`).
 *
 * A ticket tier may grant a day membership (`grants_membership_tier_id`). The
 * backend requires: a TEMPORARY tier of the event's org, `max_tickets_per_user`
 * of exactly 1, and a `purchasable_by` that is neither `members` nor
 * `invited_and_members`. The form pre-enforces all three; the server message
 * still renders inline if it ever disagrees.
 */

/** Audiences a granting tier may not use (a day member is a non-member). */
const MEMBER_ONLY_AUDIENCES = new Set(['members', 'invited_and_members']);

/** Does this `purchasable_by` value conflict with granting a membership? */
export function audienceBlocksGrant(purchasableBy: string): boolean {
	return MEMBER_ONLY_AUDIENCES.has(purchasableBy);
}

/** The only legal `max_tickets_per_user` while a grant is set. */
export const GRANT_MAX_TICKETS = '1';

/** Is a grant set (a non-empty picker value)? */
export function hasGrant(grantId: string | null | undefined): boolean {
	return !!grantId;
}

/**
 * `grants_membership_tier_id` three-way contract: omitted keeps the stored grant,
 * `null` clears it, an id replaces it. The form owns the field, so on update it
 * always sends its state (`null` when cleared, or the stored grant could never be
 * removed); on create an empty selection is omitted.
 */
export function grantsPayload(
	grantId: string,
	isUpdate: boolean
): { grants_membership_tier_id?: string | null } {
	if (grantId) return { grants_membership_tier_id: grantId };
	return isUpdate ? { grants_membership_tier_id: null } : {};
}

export interface GrantConflicts {
	/** `purchasable_by` is members-only while a grant is set. */
	audience: boolean;
	/** `max_tickets_per_user` is not 1 while a grant is set. */
	maxTickets: boolean;
}

/** Client-side mirror of the backend rules, for a final guard before submit. */
export function grantConflicts(
	grantId: string,
	purchasableBy: string,
	maxTicketsPerUser: string
): GrantConflicts {
	if (!hasGrant(grantId)) return { audience: false, maxTickets: false };
	return {
		audience: audienceBlocksGrant(purchasableBy),
		maxTickets: maxTicketsPerUser.trim() !== GRANT_MAX_TICKETS
	};
}

/** Backend field names (Django `clean` keys the model field, not the `_id` attname). */
const GRANT_FIELDS = new Set(['grants_membership_tier', 'grants_membership_tier_id']);

/** Is this error field the grant picker's? (Its message renders beside the picker.) */
export function isGrantsField(field: string): boolean {
	return GRANT_FIELDS.has(field.split('.')[0]);
}

/** Server message about the grant from a save error (any shape `extractFieldErrors` reads), or ''. */
export function grantsError(error: unknown): string {
	return extractFieldErrors(error)
		.filter(({ field }) => isGrantsField(field))
		.flatMap(({ messages }) => messages)
		.join(' ');
}
