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
 * - `apply` — refused *pending an application*: staff approval is outstanding and
 *   nothing is on file yet, so submitting one is the move (BE gate #10)
 * - `payment` — every gate is cleared; what is left is paying for a plan
 * - `questionnaire` — the user must submit the membership questionnaire first
 * - `waiting` — something is pending review (questionnaire, approval, whitelist)
 * - `retry_later` — the questionnaire can be retaken after `retry_on`
 * - `reapply` — a previous application ended; the user may apply again
 * - `member` — the user is already a member
 * - `info` — nothing actionable: invitation-only or a plain denial
 */
export type MembershipCtaKind =
	| 'join'
	| 'apply'
	| 'payment'
	| 'questionnaire'
	| 'waiting'
	| 'retry_later'
	| 'reapply'
	| 'member'
	| 'info';

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
			return 'info';
		case 'submit_application':
			// BE #831 / #735. Emitted by `PaymentReadyGate` (#10) alone, and only for
			// a PLAN-BEARING verdict: manual approval is required and the caller has
			// no application on file, so `ManualApprovalGate` (#9) deliberately fell
			// through to let the free path apply and the payment gate refuses instead.
			// The refusal is therefore not a dead end — it names its own remedy, and
			// the whole point of #735 is that the UI now offers it. It used to fold
			// into `info` (the switch had no arm and `allowed` is false), which is why
			// an approval gate was unreachable on a monetized tier: the CTA rendered
			// the org's approval POLICY prose next to nothing to press.
			return 'apply';
		case 'proceed_to_payment':
			// BE #831: gated and monetized are no longer mutually exclusive, so this
			// step is the *positive* end of a tier's gate chain — approval and
			// questionnaire (if any) are satisfied and only the charge is left. It
			// used to fold into `info`, which rendered the org's policy prose next to
			// nothing to press; the caller now sends the user at the plans instead.
			return 'payment';
	}
	// No next_step: `allowed` decides. Since BE #788 a pending tier-less
	// application arrives with an explicit `wait_for_approval`, so it is caught by
	// the switch above and never reaches here; an allowed verdict with no
	// next_step means the user really can apply (e.g. approval-required orgs with
	// no application on file, which carry reason_code `requires_approval` as
	// policy context, not as a blocker).
	//
	// The refused half of this line is also where terminal refusals land, and that
	// is deliberate on both sides. BE #812 gave the questionnaire attempts cap its
	// own code (`membership_questionnaire_attempts_exhausted`) precisely so the
	// gate could stop emitting `submit_questionnaire` to a user who can never
	// submit again: it blocks with NO next_step, which is the only way this
	// function can be told "there is no move left". `info` is that state — the
	// caller renders the explanation and no control — so the new code needs
	// nothing here beyond its REASON_MESSAGES entry. Same shape as its neighbour
	// `membership_questionnaire_failed`, which has always arrived this way.
	return e.allowed ? 'join' : 'info';
}

/**
 * The refusals that mean "a membership GATE is unsatisfied for this viewer".
 *
 * Deliberately an allow-list rather than "anything not allowed", because the
 * caller (`PlanCard`, via `TierCard`) uses it to WITHDRAW a Subscribe button:
 * a false positive hides a plan from somebody who could have taken it, which is
 * worse than the dead Subscribe button #733 is about. Every code here is
 * decided by gates #3–#9 of the backend stack
 * (`events/service/membership_manager/gates.py`) — blacklist, whitelist,
 * accept-requests, application status, questionnaire, manual approval — all of
 * which are facts about the (viewer, tier) pair and are therefore identical for
 * every plan on the tier.
 *
 * Excluded on purpose, all of them PAYMENT-READINESS refusals from gate #6 /
 * #10 rather than gates the member can clear by filling something in:
 * `tier_requires_subscription`, `plan_not_online`, `org_not_stripe_connected`,
 * `plan_unavailable`, `tier_unavailable`, `duplicate_active_subscription`,
 * `org_not_visible`. They are per-PLAN (or already modelled by the plan's own
 * `payment_method` / `sold_out` / `sales_status` fields, and by the viewer's
 * live subscription), so the plan card keeps deciding those for itself.
 * `duplicate_active_subscription` in particular is one the backend deliberately
 * lets fall THROUGH to `/subscribe` (`subscription_eligibility.
 * _ensure_plan_eligibility`), where a pending checkout resumes instead of
 * dead-ending.
 */
const GATE_BLOCKING_REASON_CODES: readonly MembershipReasonCode[] = [
	'blacklisted',
	'requires_verification',
	'whitelist_pending',
	'whitelist_rejected',
	'not_accepting_requests',
	'application_rejected',
	'membership_questionnaire_missing',
	'membership_questionnaire_pending',
	'membership_questionnaire_failed',
	'membership_questionnaire_retake_cooldown',
	'membership_questionnaire_attempts_exhausted',
	'requires_approval',
	'membership_paused'
];

/**
 * Is this viewer blocked by one of the tier's membership gates?
 *
 * The distinction that matters: a tier's `questionnaire_id` / `requires_approval`
 * say the tier IS GATED; only a verdict says whether THIS viewer is still behind
 * the gate. A member who has already passed the questionnaire comes back
 * `allowed` (with `proceed_to_payment` for a plan-bearing check) and must keep
 * every CTA a member of an ungated tier would get — hence the first line.
 */
export function isBlockedByMembershipGate(e: MembershipEligibilitySchema): boolean {
	if (e.allowed) return false;
	if (!e.reason_code) return false;
	return GATE_BLOCKING_REASON_CODES.includes(e.reason_code);
}

/**
 * What a PLAN card should put where its Subscribe button was, given the tier's
 * plan-bearing verdict.
 *
 * `null` means "nothing to do": the gates are satisfied (or say nothing about
 * this viewer) and Subscribe stands, exactly as before #733.
 *
 * - `apply` — the gate is waiting on an application that does not exist yet, and
 *   creating it is a member-side action. This is the hole #735 closes: withdrawing
 *   the CTA and stopping there left an approval-gated priced tier with no
 *   affordance at all, because — unlike a questionnaire, whose link `TierCard`
 *   renders from the tier's own `questionnaire_id` — nothing else on the page can
 *   offer to apply.
 * - `reapply` — same shape, one step later: the previous application was rejected
 *   and the backend says a fresh one supersedes it (`ApplicationStatusGate` #7).
 * - `blocked` — the remaining gate refusals, including every `wait_*` step. The
 *   card keeps #733's behaviour: no control, and the reason in its place. A wait
 *   IS the correct rendering there — there is nothing for the member to press
 *   while staff (or the grader) decide, and the tier CTA below carries the
 *   "Application pending" state and the link to track it.
 *
 * Keyed off `isBlockedByMembershipGate` first, so the same allow-list that keeps
 * the CTA from being withdrawn on a payment-readiness refusal also keeps an Apply
 * button from appearing on one.
 */
export type MembershipGateAction = 'apply' | 'reapply' | 'blocked';

export function getMembershipGateAction(
	e: MembershipEligibilitySchema
): MembershipGateAction | null {
	if (!isBlockedByMembershipGate(e)) return null;
	switch (e.next_step) {
		case 'submit_application':
			return 'apply';
		case 'reapply':
			return 'reapply';
		default:
			return 'blocked';
	}
}

/**
 * Localized prose per reason code.
 *
 * Deliberately partial: `org_not_visible`, `tier_requires_subscription`,
 * `plan_not_online` and `org_not_stripe_connected` are gate codes a plain join
 * CTA never surfaces, so they fall through to the backend `reason` string.
 *
 * `membership_questionnaire_pending` is absent for a stronger reason: it is
 * UNREACHABLE here. The backend raises it from exactly one place
 * (`membership_manager/gates.py` `_block_pending`), which always pairs it with
 * `next_step=wait_for_questionnaire_evaluation` — and that step is in
 * WAIT_STEP_MESSAGES, which is consulted first. So every verdict carrying the
 * code resolved to `wait.questionnaire_evaluation` even while the entry existed;
 * removing it changed no (next_step, reason_code) pair the backend can emit.
 * Should a future gate ever emit the code bare, `_block` still ships its own
 * prose ("Waiting for questionnaire evaluation."), so the fallback says the same
 * thing in the backend's locale rather than the generic denial.
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
	membership_questionnaire_failed: () =>
		m['membershipEligibility.reason.membership_questionnaire_failed'](),
	membership_questionnaire_retake_cooldown: () =>
		m['membershipEligibility.reason.membership_questionnaire_retake_cooldown'](),
	// BE #812. Terminal by construction: the gate blocks with no next_step, so the
	// verdict resolves to `info` and this string is the entire UI. It must not
	// point anywhere — there is no per-member attempt reset in the backend, and
	// once the cap auto-rejects the application even staff cannot approve that row
	// ("Only pending applications can be approved").
	membership_questionnaire_attempts_exhausted: () =>
		m['membershipEligibility.reason.membership_questionnaire_attempts_exhausted'](),
	requires_approval: () => m['membershipEligibility.reason.requires_approval'](),
	duplicate_active_subscription: () =>
		m['membershipEligibility.reason.duplicate_active_subscription'](),
	membership_paused: () => m['membershipEligibility.reason.membership_paused']()
};

/**
 * First-person copy for in-flight verdicts, keyed on the `wait_*` next steps.
 *
 * Live since BE #787/#788: a pending tier-less application arrives as
 * `wait_for_approval` + `requires_approval`. Consulted BEFORE REASON_MESSAGES —
 * see `getMembershipStatusMessage` for why the wait copy outranks the reason
 * copy whenever both are present.
 *
 * Deliberately partial. Two `wait_*` steps are excluded because their paired
 * reason code says something the wait copy cannot:
 * - `wait_to_retake_questionnaire` — `membership_questionnaire_retake_cooldown`
 *   keeps the dated "you can retake it later" copy.
 * - `wait_for_whitelist_approval` — `whitelist_pending` keeps the "verification"
 *   vocabulary shared with its neighbours `requires_verification` and
 *   `whitelist_rejected`, so the whole whitelist flow reads consistently.
 */
const WAIT_STEP_MESSAGES: Partial<Record<MembershipNextStep, () => string>> = {
	wait_for_questionnaire_evaluation: () =>
		m['membershipEligibility.wait.questionnaire_evaluation'](),
	wait_for_approval: () => m['membershipEligibility.wait.approval']()
};

/**
 * Human-readable, localized explanation of a membership eligibility verdict.
 *
 * Resolution order: the invite-link pair (see below) → the `wait_*` next-step
 * map → mapped `reason_code` → the backend-supplied `reason` prose → a generic
 * localized fallback. The FE-localized copy beats backend prose because the
 * backend renders it in its own locale.
 *
 * The wait map outranks the reason map because a `wait_*` step describes THIS
 * user's in-flight state while the paired reason code states the org's standing
 * policy — and the policy line reads wrong on a pending row. Since BE #787/#788
 * a pending tier-less application is `wait_for_approval` + `requires_approval`:
 * "Your application is with the organization for review" is right,
 * "Membership requests are approved by the organization" is not. The same holds
 * for `wait_for_questionnaire_evaluation` vs `membership_questionnaire_pending`,
 * where the wait copy is likewise first-person. Steps whose paired reason code
 * carries something the wait copy would lose are kept out of the map entirely —
 * see WAIT_STEP_MESSAGES for the two exclusions and why.
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
	const waiting = e.next_step ? WAIT_STEP_MESSAGES[e.next_step] : undefined;
	if (waiting) return waiting();
	const mapped = e.reason_code ? REASON_MESSAGES[e.reason_code] : undefined;
	if (mapped) return mapped();
	if (e.reason) return e.reason;
	return m['membershipEligibility.reason.generic']();
}

/**
 * Copy for the "application received" panel and application rows.
 *
 * Since BE #788 a pending application always arrives with an explicit
 * `wait_for_approval`, which `getMembershipStatusMessage` resolves to the same
 * wait copy — so the allowed-and-silent special case below is DEFENSIVE ONLY.
 * It is kept because these two call sites render for a known-pending row, where
 * a silent verdict can only mean "waiting", and falling through to the generic
 * "You can't join right now." would be actively wrong. Everything else defers
 * to getMembershipStatusMessage.
 */
export function getApplicationPendingMessage(e: MembershipEligibilitySchema): string {
	if (e.allowed && !e.next_step && !e.reason_code) {
		return m['membershipEligibility.wait.approval']();
	}
	return getMembershipStatusMessage(e);
}
