import { describe, it, expect } from 'vitest';
import {
	getActionButtonText,
	getEligibilityExplanation,
	getEligibilityRefusalMessage,
	getNextStepMessage,
	getReasonCodeMessage,
	hasAttendingSignal,
	isEligibilityRefusal,
	isMembershipTierRefusal
} from './eligibility';
import type {
	EventUserEligibility,
	EventUserStatusResponse,
	UserTicketSchema
} from '$lib/api/generated/types.gen';
import type { EventRsvpSchemaActual, EventTicketSchemaActual } from './eligibility';
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

describe('hasAttendingSignal', () => {
	function ticket(status: UserTicketSchema['status']): UserTicketSchema {
		return { id: 't1', status } as unknown as UserTicketSchema;
	}

	it('returns false for a nullish status', () => {
		expect(hasAttendingSignal(null)).toBe(false);
		expect(hasAttendingSignal(undefined)).toBe(false);
	});

	it('returns true for the unified response with an active (non-cancelled) ticket', () => {
		const status: EventUserStatusResponse = { tickets: [ticket('active')] };
		expect(hasAttendingSignal(status)).toBe(true);
	});

	it('returns true for the unified response with a positive RSVP', () => {
		const status: EventUserStatusResponse = {
			tickets: [],
			rsvp: { status: 'yes' } as EventUserStatusResponse['rsvp']
		};
		expect(hasAttendingSignal(status)).toBe(true);
	});

	it('returns false for the unified response with only a cancelled ticket and no RSVP', () => {
		const status: EventUserStatusResponse = { tickets: [ticket('cancelled')] };
		expect(hasAttendingSignal(status)).toBe(false);
	});

	it('returns false for the unified response with no tickets and no RSVP', () => {
		const status: EventUserStatusResponse = { tickets: [] };
		expect(hasAttendingSignal(status)).toBe(false);
	});

	it('returns true for a legacy RSVP with status "yes"', () => {
		const status = { status: 'yes' } as unknown as EventRsvpSchemaActual;
		expect(hasAttendingSignal(status)).toBe(true);
	});

	it('returns false for a legacy RSVP with status "no"', () => {
		const status = { status: 'no' } as unknown as EventRsvpSchemaActual;
		expect(hasAttendingSignal(status)).toBe(false);
	});

	it('returns true for a legacy ticket with status "active" or "checked_in"', () => {
		const active = { status: 'active', tier: 'x' } as unknown as EventTicketSchemaActual;
		const checkedIn = { status: 'checked_in', tier: 'x' } as unknown as EventTicketSchemaActual;
		expect(hasAttendingSignal(active)).toBe(true);
		expect(hasAttendingSignal(checkedIn)).toBe(true);
	});

	it('returns false for a legacy ticket with status "cancelled"', () => {
		const status = { status: 'cancelled', tier: 'x' } as unknown as EventTicketSchemaActual;
		expect(hasAttendingSignal(status)).toBe(false);
	});
});
