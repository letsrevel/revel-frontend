/**
 * Presentation of one `MembershipStatus` (active/paused/cancelled/banned): its
 * `Tone` and its localized label. Single source for `members/MemberCard` (the
 * roster pill) and `members/ManageMemberModal` (the status select), following
 * the same split-out pattern as `subscription-status.ts` — one map, not a copy
 * per surface that a fifth status could reach only one of.
 */
import * as m from '$lib/paraglide/messages.js';
import type { MembershipStatus } from '$lib/api/generated/types.gen';
import type { Tone } from '$lib/components/common/tones';

/**
 * `banned` is the only status with real consequences beyond this org (loses
 * access, subscription cancelled), so it alone takes `danger`. `paused` still
 * needs attention (`warning`); `cancelled` is terminal-but-not-punitive, so it
 * gets `neutral` rather than escalating alongside `banned`.
 */
const TONE_MAP: Record<MembershipStatus, Tone> = {
	active: 'success',
	paused: 'warning',
	cancelled: 'neutral',
	banned: 'danger'
};

export function getMemberStatusTone(status: MembershipStatus): Tone {
	return TONE_MAP[status];
}

const STATUS_LABELS: Record<MembershipStatus, () => string> = {
	active: () => m['memberStatus.active'](),
	paused: () => m['memberStatus.paused'](),
	cancelled: () => m['memberStatus.cancelled'](),
	banned: () => m['memberStatus.banned']()
};

export function getMemberStatusLabel(status: MembershipStatus): string {
	return STATUS_LABELS[status]();
}

/** Every `MembershipStatus`, exhaustive by construction (mirrors STATUS_ORDER). */
export const MEMBER_STATUS_ORDER: readonly MembershipStatus[] = [
	'active',
	'paused',
	'cancelled',
	'banned'
];
