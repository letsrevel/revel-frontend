/**
 * Presentation of one `MembershipRequestStatus`: its `Tone` and its localized
 * label. Single source for `members/MembershipRequestCard`'s status pill —
 * split out following `subscription-status.ts`'s pattern so the tone/label
 * pair lives in exactly one place.
 */
import * as m from '$lib/paraglide/messages.js';
import type { MembershipRequestStatus } from '$lib/api/generated/types.gen';
import type { Tone } from '$lib/components/common/tones';

/**
 * `pending` needs attention (`warning`); `approved`/`completed` both read as
 * "this went through" and share `success` — the label text, not the tone,
 * carries which of the two it was. `rejected` is the one outcome with a real
 * consequence for the applicant, so it alone escalates to `danger`.
 * `cancelled` is neutral: withdrawn, not refused.
 */
const TONE_MAP: Record<MembershipRequestStatus, Tone> = {
	pending: 'warning',
	approved: 'success',
	completed: 'success',
	rejected: 'danger',
	cancelled: 'neutral'
};

export function getMembershipRequestStatusTone(status: MembershipRequestStatus): Tone {
	// `??` guards a BE-ahead version skew: the wire can carry a status this
	// build has never heard of, and an unguarded lookup would hand `undefined`
	// to the badge rather than degrading to a reasonable default.
	return TONE_MAP[status] ?? TONE_MAP.pending;
}

const STATUS_LABELS: Record<MembershipRequestStatus, () => string> = {
	pending: () => m['membershipRequestCard.statusPending'](),
	approved: () => m['membershipRequestCard.approved'](),
	completed: () => m['membershipRequestCard.statusCompleted'](),
	rejected: () => m['membershipRequestCard.rejected'](),
	cancelled: () => m['membershipRequestCard.statusCancelled']()
};

export function getMembershipRequestStatusLabel(status: MembershipRequestStatus): string {
	// Same BE-ahead-skew guard as the tone lookup above.
	return (STATUS_LABELS[status] ?? STATUS_LABELS.pending)();
}

/** Every `MembershipRequestStatus`, exhaustive by construction. */
export const MEMBERSHIP_REQUEST_STATUS_ORDER: readonly MembershipRequestStatus[] = [
	'pending',
	'approved',
	'completed',
	'rejected',
	'cancelled'
];
