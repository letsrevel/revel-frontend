import type { EventTokenSchema, NextStep } from '$lib/api/generated/types.gen';

/**
 * Next steps that only an invitation can clear. The backend checks the
 * invitation gate first, so these (or no next step at all) mean that the user
 * does not hold an invitation yet.
 */
const INVITATION_STEPS: ReadonlySet<NextStep> = new Set([
	'request_invitation',
	'wait_for_invitation_approval'
]);

/**
 * Next steps that an invitation waiver removes. Each backend gate returns early
 * when the invitation carries the waiver, so after a claim that applies the
 * waiver the step goes away and the claim button does not come back.
 * `purchase_ticket` is not here on purpose: `waives_purchase` acts at checkout,
 * not in an eligibility gate.
 */
const WAIVABLE_STEPS: Readonly<Partial<Record<NextStep, string>>> = {
	complete_questionnaire: 'waives_questionnaire',
	wait_for_questionnaire_evaluation: 'waives_questionnaire',
	wait_to_retake_questionnaire: 'waives_questionnaire',
	become_member: 'waives_membership_required',
	wait_for_membership_approval: 'waives_membership_required',
	wait_for_membership_questionnaire_evaluation: 'waives_membership_required',
	join_waitlist: 'overrides_max_attendees',
	wait_for_open_spot: 'overrides_max_attendees'
};

function hasUsesLeft(token: EventTokenSchema): boolean {
	return !token.max_uses || (token.uses ?? 0) < token.max_uses;
}

/**
 * Whether the event page should offer to claim the invitation token instead of
 * the action for `nextStep`.
 *
 * - While the invitation gate blocks the user (or nothing blocks), a token that
 *   grants an invitation is the way in.
 * - When a later gate blocks the user and the token waives exactly that gate,
 *   claiming the token clears the step. This covers a logged-in visitor of a
 *   public event, where no invitation step is shown before the questionnaire.
 *
 * Any other step means that the claim cannot help, and offering it would loop:
 * the claim succeeds, the page reloads with the token cookie still set, and the
 * claim button comes back instead of the step that really blocks.
 */
export function shouldOfferTokenClaim(
	token: EventTokenSchema | null | undefined,
	nextStep: NextStep | null | undefined
): boolean {
	if (!token?.grants_invitation) return false;
	if (!nextStep || INVITATION_STEPS.has(nextStep)) return true;
	const waiver = WAIVABLE_STEPS[nextStep];
	if (!waiver || token.invitation_payload?.[waiver] !== true) return false;
	// A claim with no uses left fails; show the real step, not a dead button.
	return hasUsesLeft(token);
}
