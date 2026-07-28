import { describe, it, expect } from 'vitest';
import {
	getActionButtonText,
	getEligibilityExplanation,
	getEligibilityRefusalMessage,
	getNextStepMessage,
	getReasonCodeMessage,
	isEligibilityRefusal,
	isMembershipTierRefusal
} from './eligibility';
import type { EventUserEligibility } from '$lib/api/generated/types.gen';
import * as m from '$lib/paraglide/messages.js';

const EVENT_ID = '11111111-1111-1111-1111-111111111111';

/**
 * The exact body the batch purchase path answers a membership-tier refusal with
 * (`batch_ticket_service/eligibility.py:90`). It names neither the required
 * membership tiers nor whether the buyer is a non-member or a member on the
 * wrong tier — both cases produce this identical payload.
 */
const membershipTierRefusal: EventUserEligibility = {
	allowed: false,
	event_id: EVENT_ID,
	reason: 'This ticket tier requires a specific membership tier.',
	reason_code: 'membership_tier_required',
	next_step: 'upgrade_membership'
};

describe('getReasonCodeMessage', () => {
	it('maps membership_tier_required to localized copy', () => {
		expect(getReasonCodeMessage('membership_tier_required')).toBe(
			m['eligibility.reason.membership_tier_required']()
		);
	});

	it('returns null for a nullish code', () => {
		expect(getReasonCodeMessage(null)).toBeNull();
		expect(getReasonCodeMessage(undefined)).toBeNull();
	});

	it('returns null for codes with no FE copy, so the backend reason survives', () => {
		expect(getReasonCodeMessage('event_is_full')).toBeNull();
		expect(getReasonCodeMessage('sold_out')).toBeNull();
	});
});

describe('getNextStepMessage / getActionButtonText for upgrade_membership', () => {
	it('uses localized next-step copy', () => {
		expect(getNextStepMessage('upgrade_membership')).toBe(
			m['eligibility.nextStep.upgrade_membership']()
		);
	});

	it('labels the CTA with the same words as the org page membership link', () => {
		expect(getActionButtonText('upgrade_membership')).toBe(m['membershipPlans.viewMembership']());
	});

	it('does not disable the action — the plans page is reachable', () => {
		// A disabled step would render a dead button; upgrade_membership navigates.
		expect(getActionButtonText('upgrade_membership')).not.toBe('');
	});
});

describe('getEligibilityExplanation', () => {
	it('prefers the mapped reason code over the backend prose', () => {
		expect(getEligibilityExplanation(membershipTierRefusal)).toBe(
			m['eligibility.reason.membership_tier_required']()
		);
	});

	it('still falls back to the backend reason for unmapped codes', () => {
		expect(
			getEligibilityExplanation({
				allowed: false,
				event_id: EVENT_ID,
				reason: 'Event is full.',
				reason_code: 'event_is_full'
			})
		).toBe('Event is full.');
	});
});

describe('isEligibilityRefusal', () => {
	it('accepts a refusal body', () => {
		expect(isEligibilityRefusal(membershipTierRefusal)).toBe(true);
	});

	it('rejects an allowed verdict — only refusals travel on the error channel', () => {
		expect(isEligibilityRefusal({ allowed: true, event_id: EVENT_ID })).toBe(false);
	});

	it('rejects unrelated error shapes', () => {
		expect(isEligibilityRefusal(null)).toBe(false);
		expect(isEligibilityRefusal('nope')).toBe(false);
		expect(isEligibilityRefusal({ detail: 'Sold out' })).toBe(false);
		expect(isEligibilityRefusal({ allowed: false })).toBe(false);
	});
});

describe('getEligibilityRefusalMessage', () => {
	it('renders the membership-tier refusal in the user locale', () => {
		expect(getEligibilityRefusalMessage(membershipTierRefusal)).toBe(
			m['eligibility.reason.membership_tier_required']()
		);
	});

	it('falls back to the backend reason when the code has no FE copy', () => {
		expect(
			getEligibilityRefusalMessage({
				allowed: false,
				event_id: EVENT_ID,
				reason: 'Tickets are not currently on sale.',
				reason_code: 'no_tickets_on_sale'
			})
		).toBe('Tickets are not currently on sale.');
	});

	it('falls back to the next-step hint when there is no reason at all', () => {
		expect(
			getEligibilityRefusalMessage({
				allowed: false,
				event_id: EVENT_ID,
				next_step: 'join_waitlist'
			})
		).toBe(getNextStepMessage('join_waitlist'));
	});

	it('returns null for non-eligibility errors so callers keep their own fallback', () => {
		expect(getEligibilityRefusalMessage({ detail: 'boom' })).toBeNull();
		expect(getEligibilityRefusalMessage(undefined)).toBeNull();
	});
});

describe('isMembershipTierRefusal', () => {
	it('recognises the raw payload', () => {
		expect(isMembershipTierRefusal(membershipTierRefusal)).toBe(true);
	});

	it('recognises it through the Error the checkout controller throws', () => {
		const wrapped = new Error('Membership tier required.', { cause: membershipTierRefusal });
		expect(isMembershipTierRefusal(wrapped)).toBe(true);
	});

	it('does not fire on other eligibility refusals', () => {
		const soldOut: EventUserEligibility = {
			allowed: false,
			event_id: EVENT_ID,
			reason_code: 'sold_out'
		};
		expect(isMembershipTierRefusal(soldOut)).toBe(false);
		expect(isMembershipTierRefusal(new Error('Sold out', { cause: soldOut }))).toBe(false);
	});

	it('does not fire on plain errors', () => {
		expect(isMembershipTierRefusal(new Error('network down'))).toBe(false);
		expect(isMembershipTierRefusal(null)).toBe(false);
	});
});
