import type { MembershipStatus } from '$lib/api/generated/types.gen';

/**
 * What the viewer already is in the organization. Comes from the page load
 * (`permissionMyPermissions`), not from a subscription row: owner-added,
 * imported and open-ended members have no subscription at all.
 *
 * Staff are deliberately absent: they are treated like any other viewer, and the
 * member rules apply if they hold an active membership.
 */
export interface PlanViewer {
	isMember: boolean;
	membershipStatus: MembershipStatus | null;
	/** Id of the tier the viewer belongs to. */
	membershipTierId: string | null;
	isOwner: boolean;
}

export const NO_PLAN_VIEWER: PlanViewer = {
	isMember: false,
	membershipStatus: null,
	membershipTierId: null,
	isOwner: false
};

/**
 * These rules mirror revel-backend#1518.
 *
 * - `default`: no standing in the way, so the normal join/subscribe/login flow runs.
 * - `owner`: the organization owner. No join control.
 * - `own_tier`: an active member looking at a FREE plan of their own tier. Shows
 *   "current tier" and no CTA.
 * - `own_tier_paid`: an active member looking at a PAID plan of their own tier.
 *   Shows "current tier" AND keeps the Subscribe CTA (they may start paying).
 * - `free_other_tier`: an active member looking at a FREE plan of another tier.
 *   No join. A PAID plan of another tier stays `default` (tier change).
 * - `paused` / `banned`: a member whose membership is not active and who has no
 *   live subscription. No CTA, they must contact the organization.
 */
export type PlanCtaState =
	'default' | 'owner' | 'own_tier' | 'own_tier_paid' | 'free_other_tier' | 'paused' | 'banned';

export interface PlanCtaInput {
	viewer: PlanViewer;
	planTierId: string;
	planIsFree: boolean;
	/** The viewer has a live subscription row. Its own states take over. */
	hasSubscription: boolean;
	/**
	 * The viewer's subscription lookup is still in flight. Until it settles we do
	 * not know whether a subscription state will take over, so a member-based
	 * state would flash and then flip to "Your plan".
	 */
	subscriptionLoading?: boolean;
}

export function planCtaState({
	viewer,
	planTierId,
	planIsFree,
	hasSubscription,
	subscriptionLoading = false
}: PlanCtaInput): PlanCtaState {
	if (viewer.isOwner) return 'owner';
	if (subscriptionLoading || hasSubscription) return 'default';
	if (!viewer.isMember) return 'default';
	if (viewer.membershipStatus === 'paused') return 'paused';
	if (viewer.membershipStatus === 'banned') return 'banned';
	if (viewer.membershipStatus !== 'active') return 'default';
	if (viewer.membershipTierId && viewer.membershipTierId === planTierId) {
		return planIsFree ? 'own_tier' : 'own_tier_paid';
	}
	if (planIsFree) return 'free_other_tier';
	return 'default';
}
