import type { MembershipStatus } from '$lib/api/generated/types.gen';

/**
 * What the viewer already is in the organization. Comes from the page load
 * (`permissionMyPermissions`), not from a subscription row: owner-added,
 * imported and open-ended members have no subscription at all.
 */
export interface PlanViewer {
	isMember: boolean;
	membershipStatus: MembershipStatus | null;
	/** Id of the tier the viewer belongs to. */
	membershipTierId: string | null;
	isOwner: boolean;
	isStaff: boolean;
}

export const NO_PLAN_VIEWER: PlanViewer = {
	isMember: false,
	membershipStatus: null,
	membershipTierId: null,
	isOwner: false,
	isStaff: false
};

/**
 * - `default`: no standing in the way, so the normal join/subscribe/login flow runs.
 * - `staff`: owner or staff. They pass the eligibility gates but the backend
 *   refuses `/subscribe` for them, so no join control.
 * - `own_tier`: an active member looking at a plan of their own tier. The backend
 *   refuses it (`already_member`), so the card shows "current" instead.
 * - `free_other_tier`: an active member looking at a FREE plan of another tier.
 *   Refused too. A PAID plan of another tier stays `default` (tier change).
 */
export type PlanCtaState = 'default' | 'staff' | 'own_tier' | 'free_other_tier';

export interface PlanCtaInput {
	viewer: PlanViewer;
	planTierId: string;
	planIsFree: boolean;
	/** The viewer has a live subscription row. Its own states take over. */
	hasSubscription: boolean;
}

export function planCtaState({
	viewer,
	planTierId,
	planIsFree,
	hasSubscription
}: PlanCtaInput): PlanCtaState {
	if (hasSubscription) return 'default';
	if (viewer.isOwner || viewer.isStaff) return 'staff';
	if (!viewer.isMember || viewer.membershipStatus !== 'active') return 'default';
	if (viewer.membershipTierId && viewer.membershipTierId === planTierId) return 'own_tier';
	if (planIsFree) return 'free_other_tier';
	return 'default';
}
