import type {
	MembershipEligibilitySchema,
	MembershipNextStep,
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
	// DORMANT FORWARD CONTRACT — does not fire today.
	//
	// A pending tier-less application passes every gate, so its verdict comes
	// back allowed with no next_step and no reason_code. When such a verdict also
	// carries the application_id of the PENDING row, that is "wait", not "join".
	//
	// Today the standalone GET join-eligibility endpoint does NOT attach
	// application_id to an allowed verdict — the backend injects it only on the
	// apply and get-application responses (me_applications.py:124-125,152) — so
	// this branch is unreachable from the org page, and the live org-CTA/account-hub
	// contradiction it addresses is still reproducible. That is tracked as BE #788.
	// When #788 lands (attaching application_id, or an explicit next_step, to the
	// join-eligibility verdict) this branch activates with no further FE change.
	//
	// A silent allowed verdict WITHOUT an application_id is genuinely free to join.
	if (e.allowed && !e.next_step && !e.reason_code && e.application_id) return 'waiting';
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
 * Copy for in-flight verdicts that carry no reason_code (e.g. a tier-less
 * PENDING application). Consulted after REASON_MESSAGES, before backend prose.
 */
const WAIT_STEP_MESSAGES: Partial<Record<MembershipNextStep, () => string>> = {
	wait_for_questionnaire_evaluation: () =>
		m['membershipEligibility.wait.questionnaire_evaluation'](),
	wait_for_approval: () => m['membershipEligibility.wait.approval'](),
	wait_for_whitelist_approval: () => m['membershipEligibility.wait.whitelist_approval']()
};

/**
 * Human-readable, localized explanation of a membership eligibility verdict.
 *
 * Resolution order: the invite-link pair (see below) → mapped `reason_code` →
 * the `wait_*` next-step map → the backend-supplied `reason` prose → a generic
 * localized fallback. The FE-localized wait copy beats backend prose because the
 * backend renders it in its own locale.
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
	const waiting = e.next_step ? WAIT_STEP_MESSAGES[e.next_step] : undefined;
	if (waiting) return waiting();
	if (e.reason) return e.reason;
	return m['membershipEligibility.reason.generic']();
}

/**
 * Copy for the "application received" panel and application rows: a verdict
 * that is allowed but carries no explanation is a PENDING application waiting
 * for the organization (tier-less applications pass every gate yet stay
 * PENDING until staff assigns a tier on approval). Everything else defers to
 * getMembershipStatusMessage.
 *
 * This is the prose counterpart to the silent-pending branch in
 * `getMembershipCtaKind`, but it deliberately does NOT also require
 * `application_id`: callers render it only for a known-pending application, so
 * the row's existence is already established by context. `getMembershipCtaKind`
 * has no such context — it reads a standalone verdict — so there
 * `application_id` is the only thing separating "waiting" from "free to join".
 */
export function getApplicationPendingMessage(e: MembershipEligibilitySchema): string {
	if (e.allowed && !e.next_step && !e.reason_code) {
		return m['membershipEligibility.wait.approval']();
	}
	return getMembershipStatusMessage(e);
}
