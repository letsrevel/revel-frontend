/**
 * Membership-tier links on the ticket-tier create/update payload.
 *
 * Backend contract for `restricted_to_membership_tiers_ids` and
 * `excluded_membership_tiers_ids`: omitted/null keeps the stored links, `[]`
 * clears them, non-empty replaces them.
 */
/** Purchasable-by values under which the backend allows membership-tier restrictions. */
export function allowsMembershipRestrictions(purchasableBy: string): boolean {
	return purchasableBy === 'members' || purchasableBy === 'invited_and_members';
}

/**
 * `restricted_to_membership_tiers_ids` three-way contract: omitted/null keeps the
 * stored links, `[]` clears them, non-empty replaces them. On update an empty
 * selection must therefore send `[]` (never null), or un-ticking every
 * restriction, or switching to a purchasable-by that forbids them, can never save.
 * On create there is nothing to keep, so null stays.
 */
export function restrictedTiersPayload(
	purchasableBy: string,
	ids: string[],
	isUpdate: boolean
): string[] | null {
	const effective = allowsMembershipRestrictions(purchasableBy) ? ids : [];
	if (effective.length > 0) return effective;
	return isUpdate ? [] : null;
}

/**
 * `excluded_membership_tiers_ids` three-way contract (same as the restrictions):
 * omitted/null keeps the stored links, `[]` clears them, non-empty replaces them.
 * Only legal on `non_members` tiers, where an empty list means "exclude every
 * active member" and a non-empty one excludes only members of those tiers. On
 * update an empty selection (or any other audience) must therefore send `[]`
 * so the saved state matches the form; on create there is nothing to keep.
 */
export function excludedTiersPayload(
	purchasableBy: string,
	ids: string[],
	isUpdate: boolean
): string[] | null {
	const effective = purchasableBy === 'non_members' ? ids : [];
	if (effective.length > 0) return effective;
	return isUpdate ? [] : null;
}

/** Ids of the membership tiers the backend returned on a tier (restricted/excluded list). */
export function linkedTierIds(
	tiers: readonly { id?: string | null }[] | null | undefined
): string[] {
	return (tiers ?? []).map((t) => t.id).filter((id): id is string => !!id);
}

/**
 * Link fields for the payload. On update an empty selection must send `[]`
 * (never null) for both lists, or un-ticking every link, or switching to a
 * purchasable-by that forbids them, can never save. On create an empty
 * selection is omitted.
 */
export function membershipLinksPayload(
	purchasableBy: string,
	restrictedIds: string[],
	isUpdate: boolean,
	excludedIds: string[] = []
): {
	restricted_to_membership_tiers_ids: string[] | null;
	excluded_membership_tiers_ids: string[] | null;
} {
	return {
		restricted_to_membership_tiers_ids: restrictedTiersPayload(
			purchasableBy,
			restrictedIds,
			isUpdate
		),
		excluded_membership_tiers_ids: excludedTiersPayload(purchasableBy, excludedIds, isUpdate)
	};
}

/** Backend field names whose validation message belongs next to the excluded-tiers picker. */
const EXCLUDED_TIERS_FIELDS = new Set([
	'excluded_membership_tiers_ids',
	'excluded_membership_tiers'
]);

/**
 * Server message about the exclusion list from a save error, or ''. Handles the
 * field-keyed `{ errors: { field: [..] } }` body; plain `detail` strings stay in
 * the form-level error panel.
 */
export function excludedTiersError(
	fieldErrors: readonly { field: string; messages: string[] }[]
): string {
	return fieldErrors
		.filter(({ field }) => EXCLUDED_TIERS_FIELDS.has(field.split('.')[0]))
		.flatMap(({ messages }) => messages)
		.join(' ');
}
