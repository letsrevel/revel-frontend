import type {
	MembershipEligibilitySchema,
	MembershipReasonCode
} from '$lib/api/generated/types.gen';
import * as m from '$lib/paraglide/messages.js';

/**
 * The shape of call-to-action a membership eligibility verdict implies.
 *
 * - `join` — allowed, free path → open the apply dialog
 * - `questionnaire` — the user must submit the membership questionnaire first
 * - `waiting` — something is pending review (questionnaire, approval, whitelist)
 * - `retry_later` — the questionnaire can be retaken after `retry_on`
 * - `reapply` — a previous application ended; the user may apply again
 * - `member` — the user is already a member
 * - `info` — nothing actionable: invitation-only, payment-gated, or a plain denial
 */
export type MembershipCtaKind =
	'join' | 'questionnaire' | 'waiting' | 'retry_later' | 'reapply' | 'member' | 'info';

/**
 * Map a membership eligibility verdict to the CTA the UI should render.
 *
 * `next_step` wins over `allowed` (a member is `allowed` but must not see a join
 * button). When there is no `next_step`, `allowed` decides between join and info.
 */
export function getMembershipCtaKind(e: MembershipEligibilitySchema): MembershipCtaKind {
	switch (e.next_step) {
		case 'already_member':
			return 'member';
		case 'submit_questionnaire':
			return 'questionnaire';
		case 'wait_for_questionnaire_evaluation':
		case 'wait_for_approval':
		case 'wait_for_whitelist_approval':
			return 'waiting';
		case 'wait_to_retake_questionnaire':
			return 'retry_later';
		case 'reapply':
			return 'reapply';
		case 'requires_invitation':
		case 'proceed_to_payment':
			return 'info';
	}
	return e.allowed ? 'join' : 'info';
}

/**
 * Localized prose per reason code.
 *
 * Deliberately partial: `org_not_visible`, `tier_requires_subscription`,
 * `plan_not_online` and `org_not_stripe_connected` are gate codes a plain join
 * CTA never surfaces, so they fall through to the backend `reason` string.
 */
const REASON_MESSAGES: Partial<Record<MembershipReasonCode, () => string>> = {
	blacklisted: () => m['membershipEligibility.reason.blacklisted'](),
	requires_verification: () => m['membershipEligibility.reason.requires_verification'](),
	whitelist_pending: () => m['membershipEligibility.reason.whitelist_pending'](),
	whitelist_rejected: () => m['membershipEligibility.reason.whitelist_rejected'](),
	already_active_member: () => m['membershipEligibility.reason.already_active_member'](),
	not_accepting_requests: () => m['membershipEligibility.reason.not_accepting_requests'](),
	tier_unavailable: () => m['membershipEligibility.reason.tier_unavailable'](),
	plan_unavailable: () => m['membershipEligibility.reason.plan_unavailable'](),
	application_rejected: () => m['membershipEligibility.reason.application_rejected'](),
	membership_questionnaire_missing: () =>
		m['membershipEligibility.reason.membership_questionnaire_missing'](),
	membership_questionnaire_pending: () =>
		m['membershipEligibility.reason.membership_questionnaire_pending'](),
	membership_questionnaire_failed: () =>
		m['membershipEligibility.reason.membership_questionnaire_failed'](),
	membership_questionnaire_retake_cooldown: () =>
		m['membershipEligibility.reason.membership_questionnaire_retake_cooldown'](),
	requires_approval: () => m['membershipEligibility.reason.requires_approval'](),
	duplicate_active_subscription: () =>
		m['membershipEligibility.reason.duplicate_active_subscription'](),
	membership_paused: () => m['membershipEligibility.reason.membership_paused']()
};

/**
 * Human-readable, localized explanation of a membership eligibility verdict.
 *
 * Resolution order: the invite-link pair (see below) → mapped `reason_code` →
 * the backend-supplied `reason` prose → a generic localized fallback.
 *
 * `next_step === 'requires_invitation'` is NOT a blanket override. The backend
 * emits it only alongside `reason_code` `requires_verification` or
 * `not_accepting_requests` (`membership_manager/gates.py:143,191`), and only the
 * latter actually means "ask for an invite link" — a user who needs to verify
 * their account must be told to verify, not to chase an invite.
 */
export function getMembershipStatusMessage(e: MembershipEligibilitySchema): string {
	const invitesOnly =
		e.next_step === 'requires_invitation' &&
		(!e.reason_code || e.reason_code === 'not_accepting_requests');
	if (invitesOnly) {
		return m['membershipEligibility.reason.requires_invitation']();
	}
	const mapped = e.reason_code ? REASON_MESSAGES[e.reason_code] : undefined;
	if (mapped) return mapped();
	if (e.reason) return e.reason;
	return m['membershipEligibility.reason.generic']();
}
