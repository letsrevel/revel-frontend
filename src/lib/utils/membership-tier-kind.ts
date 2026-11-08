import type { MembershipTierKind } from '$lib/api/generated/types.gen';

/**
 * Membership tiers come in two kinds (BE epic #1317): `standard` (a real,
 * ongoing membership) and `temporary` (a "day membership" granted by a ticket,
 * valid for the event it was bought for). The admin tier list returns BOTH, but
 * every picker that sends a tier id to the backend (member assignment, approval,
 * org tokens, ticket-tier restrictions, polls, announcements, subscription
 * plans) is refused or silently drops temporary ids — so those pickers must
 * only offer standard tiers. Route them all through this helper rather than
 * re-deriving the filter inline. Only the tier management list and the ticket
 * "grants membership" picker (temporary only) should see the unfiltered list.
 */
export function standardTiers<T extends { kind: MembershipTierKind }>(
	tiers: readonly T[] | null | undefined
): T[] {
	return (tiers ?? []).filter((tier) => tier.kind === 'standard');
}
