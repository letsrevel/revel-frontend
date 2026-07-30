import { describe, it, expect } from 'vitest';
import {
	getApplicationPendingMessage,
	getMembershipCtaKind,
	getMembershipStatusMessage,
	isBlockedByMembershipGate
} from './membership-eligibility';
import type { MembershipEligibilitySchema } from '$lib/api/generated/types.gen';
import * as m from '$lib/paraglide/messages.js';

const base: MembershipEligibilitySchema = { allowed: false, organization_id: 'org-1' };

describe('getMembershipCtaKind', () => {
	it('maps allowed free path to join', () => {
		expect(getMembershipCtaKind({ ...base, allowed: true })).toBe('join');
	});
	it('maps already_member to member even when allowed', () => {
		expect(getMembershipCtaKind({ ...base, allowed: true, next_step: 'already_member' })).toBe(
			'member'
		);
	});
	it('maps submit_questionnaire to questionnaire', () => {
		expect(
			getMembershipCtaKind({ ...base, next_step: 'submit_questionnaire', questionnaire_id: 'q1' })
		).toBe('questionnaire');
	});
	it('maps the three wait states to waiting', () => {
		for (const s of [
			'wait_for_questionnaire_evaluation',
			'wait_for_approval',
			'wait_for_whitelist_approval'
		] as const) {
			expect(getMembershipCtaKind({ ...base, next_step: s })).toBe('waiting');
		}
	});
	it('maps retake cooldown to retry_later', () => {
		expect(
			getMembershipCtaKind({
				...base,
				next_step: 'wait_to_retake_questionnaire',
				retry_on: '2026-08-01T00:00:00Z'
			})
		).toBe('retry_later');
	});
	it('maps reapply to reapply', () => {
		expect(getMembershipCtaKind({ ...base, next_step: 'reapply' })).toBe('reapply');
	});
	it('maps requires_invitation and bare denials to info', () => {
		expect(getMembershipCtaKind({ ...base, next_step: 'requires_invitation' })).toBe('info');
		expect(getMembershipCtaKind({ ...base, reason_code: 'membership_paused' })).toBe('info');
	});

	// BE #831 made gated and monetized tiers coexist, so this step is the positive
	// end of a tier's gate chain: everything else is satisfied and only the charge
	// is left. Folded into `info` before #720, where it rendered policy prose and
	// no control — the exact dead end this issue is about.
	it('maps proceed_to_payment to payment, not to info', () => {
		expect(getMembershipCtaKind({ ...base, next_step: 'proceed_to_payment' })).toBe('payment');
		// Also when the verdict is refused-but-payable: the block IS the payment.
		expect(
			getMembershipCtaKind({
				...base,
				allowed: false,
				next_step: 'proceed_to_payment',
				reason_code: 'tier_requires_subscription',
				plan_id: 'plan-1'
			})
		).toBe('payment');
	});

	// BE #812, pinned field-for-field as `MembershipQuestionnaireGate._handle_rejected`
	// emits it: refused, no next_step, and a `questionnaire_id` still attached (the
	// gate passes it for context). `info` is the whole point — the previous verdict
	// was `submit_questionnaire`, which sent the member through the entire
	// questionnaire to collect a guaranteed 400 on submit.
	it('maps the exhausted-attempts verdict to info, not to the questionnaire', () => {
		expect(
			getMembershipCtaKind({
				...base,
				allowed: false,
				next_step: null,
				reason_code: 'membership_questionnaire_attempts_exhausted',
				questionnaire_id: 'q1',
				reason: 'You have reached the maximum number of attempts.'
			})
		).toBe('info');
	});

	// Its terminal neighbour, same shape — the two must not diverge.
	it('maps the failed-questionnaire verdict to info as well', () => {
		expect(getMembershipCtaKind({ ...base, reason_code: 'membership_questionnaire_failed' })).toBe(
			'info'
		);
	});

	// The two verdict shapes BE #786-788 emit for approval-gated orgs, pinned
	// field-for-field as the backend sends them. Both are `allowed: true`, so the
	// only thing separating "already applied" from "may apply" is next_step —
	// which is exactly why the FE must not key this off `allowed` alone.
	it('maps the pending tier-less application shape to waiting', () => {
		expect(
			getMembershipCtaKind({
				...base,
				allowed: true,
				next_step: 'wait_for_approval',
				reason_code: 'requires_approval',
				application_id: 'app-1',
				reason: 'Membership requests are approved by the organization.'
			})
		).toBe('waiting');
	});

	it('maps the approval-required-but-no-application shape to join', () => {
		expect(getMembershipCtaKind({ ...base, allowed: true, reason_code: 'requires_approval' })).toBe(
			'join'
		);
	});
});

describe('getMembershipStatusMessage', () => {
	it('prefers the mapped reason_code message', () => {
		const msg = getMembershipStatusMessage({
			...base,
			reason_code: 'not_accepting_requests',
			reason: 'BE prose'
		});
		expect(msg).not.toBe('BE prose');
		expect(msg.length).toBeGreaterThan(0);
	});
	it('falls back to BE reason for unmapped codes', () => {
		expect(
			getMembershipStatusMessage({
				...base,
				reason_code: 'org_not_stripe_connected',
				reason: 'BE prose'
			})
		).toBe('BE prose');
	});
	it('falls back to generic when nothing is available', () => {
		expect(getMembershipStatusMessage(base).length).toBeGreaterThan(0);
	});

	// BE #812. The backend deliberately reuses the submit endpoint's msgid here, so
	// the fall-through would have "worked" — but in the backend's locale. The
	// mapped entry is what makes the verdict speak the member's language.
	it('localizes the exhausted-attempts code instead of echoing the backend prose', () => {
		const msg = getMembershipStatusMessage({
			...base,
			reason_code: 'membership_questionnaire_attempts_exhausted',
			questionnaire_id: 'q1',
			reason: 'You have reached the maximum number of attempts.'
		});
		expect(msg).toBe(
			m['membershipEligibility.reason.membership_questionnaire_attempts_exhausted']()
		);
		expect(msg).not.toBe('You have reached the maximum number of attempts.');
		expect(msg).not.toBe(m['membershipEligibility.reason.generic']());
	});

	// Both are terminal, but they say different things: one is "we read it and said
	// no", the other is "you have nothing left to send". Collapsing them would tell
	// a capped member their answers were rejected.
	it('keeps the exhausted-attempts copy distinct from the failed-questionnaire copy', () => {
		expect(
			m['membershipEligibility.reason.membership_questionnaire_attempts_exhausted']()
		).not.toBe(m['membershipEligibility.reason.membership_questionnaire_failed']());
	});

	// The backend only ever emits next_step=requires_invitation paired with
	// reason_code requires_verification or not_accepting_requests
	// (membership_manager/gates.py:143,191), so precedence between the two matters.
	it('prefers the verification message over the invite copy when both are present', () => {
		expect(
			getMembershipStatusMessage({
				...base,
				reason_code: 'requires_verification',
				next_step: 'requires_invitation'
			})
		).toBe(m['membershipEligibility.reason.requires_verification']());
	});
	it('uses the invite-link copy for not_accepting_requests + requires_invitation', () => {
		expect(
			getMembershipStatusMessage({
				...base,
				reason_code: 'not_accepting_requests',
				next_step: 'requires_invitation'
			})
		).toBe(m['membershipEligibility.reason.requires_invitation']());
	});
	it('uses the invite-link copy for requires_invitation with no reason_code', () => {
		expect(getMembershipStatusMessage({ ...base, next_step: 'requires_invitation' })).toBe(
			m['membershipEligibility.reason.requires_invitation']()
		);
	});
	it('keeps the verification and invite messages distinct', () => {
		expect(m['membershipEligibility.reason.requires_verification']()).not.toBe(
			m['membershipEligibility.reason.requires_invitation']()
		);
	});
});

describe('wait_* next-step messages', () => {
	it('maps wait_for_approval when no reason_code is set', () => {
		const msg = getMembershipStatusMessage({ ...base, next_step: 'wait_for_approval' });
		expect(msg).toBe(m['membershipEligibility.wait.approval']());
	});

	// Excluded from the wait map on purpose: whitelist_pending keeps the
	// "verification" vocabulary shared with requires_verification and
	// whitelist_rejected, so the whole whitelist flow reads consistently.
	it('leaves the whitelist pairing on its verification copy', () => {
		const msg = getMembershipStatusMessage({
			...base,
			next_step: 'wait_for_whitelist_approval',
			reason_code: 'whitelist_pending'
		});
		expect(msg).toBe(m['membershipEligibility.reason.whitelist_pending']());
	});

	it('maps wait_for_questionnaire_evaluation over backend prose', () => {
		const msg = getMembershipStatusMessage({
			...base,
			next_step: 'wait_for_questionnaire_evaluation',
			reason: 'Some backend-locale sentence'
		});
		expect(msg).toBe(m['membershipEligibility.wait.questionnaire_evaluation']());
	});

	// The exact pair the backend emits from `_block_pending`, and the reason the
	// `membership_questionnaire_pending` entry could be dropped from REASON_MESSAGES
	// (#697): the wait map is consulted first, so the code never got a say. Pinned
	// with the backend's own prose attached, to prove the removal did not open a
	// fall-through to it.
	it('resolves the pending-questionnaire pair to the wait copy, not the backend prose', () => {
		const msg = getMembershipStatusMessage({
			...base,
			next_step: 'wait_for_questionnaire_evaluation',
			reason_code: 'membership_questionnaire_pending',
			reason: 'Waiting for questionnaire evaluation.'
		});
		expect(msg).toBe(m['membershipEligibility.wait.questionnaire_evaluation']());
		expect(msg).not.toBe('Waiting for questionnaire evaluation.');
	});

	// Full shape 1 as the BE sends it, localized `reason` prose included — so this
	// also pins that the wait copy beats both the reason map and the BE prose.
	it('describes the pending tier-less application, not the approval policy', () => {
		const msg = getMembershipStatusMessage({
			...base,
			allowed: true,
			next_step: 'wait_for_approval',
			reason_code: 'requires_approval',
			application_id: 'app-1',
			reason: 'Membership requests are approved by the organization.'
		});
		expect(msg).toBe(m['membershipEligibility.wait.approval']());
		expect(msg).not.toBe(m['membershipEligibility.reason.requires_approval']());
		expect(msg).not.toBe('Membership requests are approved by the organization.');
	});

	// wait_to_retake_questionnaire is absent from the wait map, so the reorder
	// must not cost it its dated cooldown copy.
	it('keeps the dated cooldown copy for the retake step', () => {
		const msg = getMembershipStatusMessage({
			...base,
			next_step: 'wait_to_retake_questionnaire',
			reason_code: 'membership_questionnaire_retake_cooldown',
			retry_on: '2026-08-01T00:00:00Z'
		});
		expect(msg).toBe(m['membershipEligibility.reason.membership_questionnaire_retake_cooldown']());
	});

	it('leaves next steps outside the wait map on the backend-prose path', () => {
		expect(getMembershipStatusMessage({ ...base, next_step: 'reapply', reason: 'BE prose' })).toBe(
			'BE prose'
		);
	});
});

// Since BE #788 a pending application carries an explicit wait_for_approval, so
// getMembershipStatusMessage already resolves it to the wait copy. The
// allowed-and-silent case below is defensive only: these call sites render for a
// known-pending row, where falling through to "You can't join right now." would
// be actively wrong.
describe('getApplicationPendingMessage', () => {
	it('reads a tier-less allowed-but-silent verdict as an application awaiting approval', () => {
		const msg = getApplicationPendingMessage({
			...base,
			allowed: true,
			next_step: null,
			reason_code: null,
			reason: null
		});
		expect(msg).toBe(m['membershipEligibility.wait.approval']());
		expect(msg).not.toBe(m['membershipEligibility.reason.generic']());
	});

	it('defers to getMembershipStatusMessage when the verdict explains itself', () => {
		const verdict: MembershipEligibilitySchema = {
			...base,
			reason_code: 'application_rejected'
		};
		expect(getApplicationPendingMessage(verdict)).toBe(getMembershipStatusMessage(verdict));
		expect(getApplicationPendingMessage(verdict)).toBe(
			m['membershipEligibility.reason.application_rejected']()
		);
	});

	it('does not claim approval is pending for a plain denial', () => {
		const verdict: MembershipEligibilitySchema = { ...base, allowed: false };
		expect(getApplicationPendingMessage(verdict)).toBe(m['membershipEligibility.reason.generic']());
	});
});

// #733. The predicate a plan card's Subscribe button is withdrawn on, so the two
// directions are not symmetric: a false positive hides a plan from somebody who
// could have taken it, while a false negative only reproduces today's behaviour
// (the backend runs the same gates on POST /subscribe and refuses).
describe('isBlockedByMembershipGate', () => {
	it('never blocks an allowed verdict, whatever policy context it carries', () => {
		expect(isBlockedByMembershipGate({ ...base, allowed: true })).toBe(false);
		// The tier states "approval required" as POLICY while still allowing this
		// viewer — `check_eligibility`'s annotation. Reading the code alone here
		// would withdraw the CTA from every eligible member of an approval tier.
		expect(
			isBlockedByMembershipGate({ ...base, allowed: true, reason_code: 'requires_approval' })
		).toBe(false);
		// The positive end of a gated + priced tier's chain: gates cleared, charge left.
		expect(
			isBlockedByMembershipGate({ ...base, allowed: true, next_step: 'proceed_to_payment' })
		).toBe(false);
	});

	it('blocks the questionnaire gate in every state it can be in', () => {
		for (const code of [
			'membership_questionnaire_missing',
			'membership_questionnaire_pending',
			'membership_questionnaire_failed',
			'membership_questionnaire_retake_cooldown',
			'membership_questionnaire_attempts_exhausted'
		] as const) {
			expect(isBlockedByMembershipGate({ ...base, reason_code: code })).toBe(true);
		}
	});

	// `PaymentReadyGate`'s SUBMIT_APPLICATION: approval is required and nothing is
	// on file yet, so the member must apply before there is anything to pay for.
	it('blocks manual approval, applied-for or not', () => {
		expect(
			isBlockedByMembershipGate({
				...base,
				reason_code: 'requires_approval',
				next_step: 'submit_application'
			})
		).toBe(true);
		expect(
			isBlockedByMembershipGate({
				...base,
				reason_code: 'requires_approval',
				next_step: 'wait_for_approval',
				application_id: 'app-1'
			})
		).toBe(true);
	});

	// Payment-readiness refusals are NOT gates: the plan card already models them
	// from the plan's own fields and the viewer's live subscription, and
	// `duplicate_active_subscription` is one the backend deliberately lets fall
	// through to /subscribe so a half-finished checkout can resume.
	it('leaves payment-readiness refusals to the plan card', () => {
		for (const code of [
			'tier_requires_subscription',
			'plan_not_online',
			'org_not_stripe_connected',
			'plan_unavailable',
			'tier_unavailable',
			'duplicate_active_subscription'
		] as const) {
			expect(isBlockedByMembershipGate({ ...base, reason_code: code })).toBe(false);
		}
	});

	// A refusal the frontend cannot classify is not treated as a gate: the CTA
	// stays, and the backend refuses it if it really is unreachable.
	it('does not block a refusal with no reason code', () => {
		expect(isBlockedByMembershipGate({ ...base, allowed: false, reason_code: null })).toBe(false);
	});
});
