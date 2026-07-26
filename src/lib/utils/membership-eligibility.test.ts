import { describe, it, expect } from 'vitest';
import { getMembershipCtaKind, getMembershipStatusMessage } from './membership-eligibility';
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
