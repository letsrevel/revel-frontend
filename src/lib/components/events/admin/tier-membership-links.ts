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
 * Link fields for the payload. On update an empty restriction selection must send
 * `[]` (never null) and exclusions (only legal on non_members tiers, no picker in
 * this form) are cleared off non_members, or those saves are rejected or ignored.
 */
export function membershipLinksPayload(
	purchasableBy: string,
	restrictedIds: string[],
	isUpdate: boolean
): { restricted_to_membership_tiers_ids: string[] | null; excluded_membership_tiers_ids?: [] } {
	return {
		restricted_to_membership_tiers_ids: restrictedTiersPayload(
			purchasableBy,
			restrictedIds,
			isUpdate
		),
		...(isUpdate && purchasableBy !== 'non_members' ? { excluded_membership_tiers_ids: [] } : {})
	};
}
