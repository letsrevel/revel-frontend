import * as m from '$lib/paraglide/messages.js';

/**
 * Mirror of the backend's `tier_rule_stricter_than_pass`
 * (revel-backend `events/utils/purchase_rules.py`, #1332 / #1344).
 *
 * A tier is stricter than a pass when some buyer the pass admits is not admitted
 * by the tier, so the pass cannot cover it. Buyers: M = eligible members,
 * I = invitees.
 *
 * - `public`              -> everyone
 * - `members`             -> M
 * - `invited`             -> I
 * - `invited_and_members` -> M or I
 * - `non_members`         -> not M
 *
 * `excluded_membership_tiers` is deliberately NOT a stricter signal (it only
 * narrows who is excluded from a `non_members` tier). A pass carries no
 * membership-tier restriction, so a tier that has one is always stricter.
 * An unknown pass rule fails closed.
 */
const ALLOWED_TIER_RULES: Record<string, ReadonlySet<string>> = {
	public: new Set(['public']),
	members: new Set(['public', 'members', 'invited_and_members']),
	invited: new Set(['public', 'invited', 'invited_and_members']),
	invited_and_members: new Set(['public', 'invited_and_members']),
	non_members: new Set(['public', 'non_members'])
};

export function tierRuleStricterThanPass(
	tierRule: string | null | undefined,
	passRule: string | null | undefined,
	tierRestrictedToMembershipTiers: boolean
): boolean {
	if (tierRestrictedToMembershipTiers) return true;
	return !ALLOWED_TIER_RULES[passRule ?? '']?.has(tierRule ?? 'public');
}

/** Convenience wrapper over a tier row as the admin list returns it. */
export function tierStricterThanPass(
	tier: {
		purchasable_by?: string | null;
		restricted_to_membership_tiers?: readonly unknown[] | null;
	},
	passRule: string | null | undefined
): boolean {
	return tierRuleStricterThanPass(
		tier.purchasable_by ?? 'public',
		passRule,
		(tier.restricted_to_membership_tiers?.length ?? 0) > 0
	);
}

/** Localized "who can buy" label for a pass. */
export function purchasableByLabel(value: string | null | undefined): string {
	switch (value) {
		case 'members':
			return m['seriesPassAdmin.purchasableMembers']();
		case 'non_members':
			return m['seriesPassAdmin.purchasableNonMembers']();
		case 'public':
		case undefined:
		case null:
			return m['seriesPassAdmin.purchasablePublic']();
		default:
			return value.replace(/_/g, ' ');
	}
}
