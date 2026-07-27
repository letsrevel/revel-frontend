import { describe, it, expect } from 'vitest';
import {
	getApplicationPendingMessage,
	getMembershipCtaKind,
	getMembershipStatusMessage
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

	// Forward contract, dormant today. A pending tier-less application yields an
	// allowed verdict with no next_step and no reason_code; application_id is the
	// only thing that could distinguish "already applied, waiting" from "free to
	// join". The standalone join-eligibility endpoint does not attach it yet
	// (backend only does so on apply/get-application), so these pin the behaviour
	// for when BE #788 lands rather than describing what the org page does today.
	it('treats a silent allowed verdict as waiting once the backend attaches application_id (#788)', () => {
		expect(getMembershipCtaKind({ ...base, allowed: true, application_id: 'app-1' })).toBe(
			'waiting'
		);
	});

	it('still maps a silent allowed verdict with no application to join — the shape the endpoint returns today', () => {
		expect(getMembershipCtaKind({ ...base, allowed: true, application_id: null })).toBe('join');
	});

	it('would not treat a denial carrying an application_id as waiting', () => {
		expect(getMembershipCtaKind({ ...base, allowed: false, application_id: 'app-1' })).toBe('info');
	});

	it('lets an explicit next_step outrank the application_id branch', () => {
		expect(
			getMembershipCtaKind({
				...base,
				allowed: true,
				application_id: 'app-1',
				next_step: 'already_member'
			})
		).toBe('member');
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

	it('maps wait_for_whitelist_approval when no reason_code is set', () => {
		const msg = getMembershipStatusMessage({ ...base, next_step: 'wait_for_whitelist_approval' });
		expect(msg).toBe(m['membershipEligibility.wait.whitelist_approval']());
	});

	it('maps wait_for_questionnaire_evaluation over backend prose', () => {
		const msg = getMembershipStatusMessage({
			...base,
			next_step: 'wait_for_questionnaire_evaluation',
			reason: 'Some backend-locale sentence'
		});
		expect(msg).toBe(m['membershipEligibility.wait.questionnaire_evaluation']());
	});

	it('a mapped reason_code still wins over the wait-step map', () => {
		const msg = getMembershipStatusMessage({
			...base,
			next_step: 'wait_for_questionnaire_evaluation',
			reason_code: 'membership_questionnaire_pending'
		});
		expect(msg).toBe(m['membershipEligibility.reason.membership_questionnaire_pending']());
	});

	it('leaves next steps outside the wait map on the backend-prose path', () => {
		expect(getMembershipStatusMessage({ ...base, next_step: 'reapply', reason: 'BE prose' })).toBe(
			'BE prose'
		);
	});
});

// A tier-less application passes every gate, so check_eligibility falls through
// to `allowed=True` with no next_step/reason_code/reason (membership_manager/
// service.py). The row still stays PENDING because staff assign the tier on
// approval — so this verdict must not read as a denial.
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
			reason_code: 'membership_questionnaire_pending'
		};
		expect(getApplicationPendingMessage(verdict)).toBe(getMembershipStatusMessage(verdict));
		expect(getApplicationPendingMessage(verdict)).toBe(
			m['membershipEligibility.reason.membership_questionnaire_pending']()
		);
	});

	it('does not claim approval is pending for a plain denial', () => {
		const verdict: MembershipEligibilitySchema = { ...base, allowed: false };
		expect(getApplicationPendingMessage(verdict)).toBe(m['membershipEligibility.reason.generic']());
	});
});
