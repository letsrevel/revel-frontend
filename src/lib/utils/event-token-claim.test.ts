import { describe, it, expect } from 'vitest';
import type { EventTokenSchema, NextStep } from '$lib/api/generated/types.gen';
import { shouldOfferTokenClaim } from './event-token-claim';

const base: EventTokenSchema = {
	id: 'et-1',
	event_name: 'Gala',
	event_slug: 'gala',
	organization_slug: 'acme',
	event_start: '2030-01-01T20:00:00Z',
	issuer: 'issuer-1',
	event: 'event-1',
	grants_invitation: true,
	created_at: '2029-01-01T00:00:00Z'
};

const withWaiver = (waiver: string, extra: Partial<EventTokenSchema> = {}): EventTokenSchema => ({
	...base,
	invitation_payload: { [waiver]: true },
	...extra
});

describe('shouldOfferTokenClaim', () => {
	it.each<NextStep | null | undefined>([
		null,
		undefined,
		'request_invitation',
		'wait_for_invitation_approval'
	])('offers the claim while the invitation gate blocks (%s)', (step) => {
		expect(shouldOfferTokenClaim(base, step)).toBe(true);
	});

	it.each<[NextStep, string]>([
		['complete_questionnaire', 'waives_questionnaire'],
		['wait_for_questionnaire_evaluation', 'waives_questionnaire'],
		['wait_to_retake_questionnaire', 'waives_questionnaire'],
		['become_member', 'waives_membership_required'],
		['wait_for_membership_approval', 'waives_membership_required'],
		['wait_for_membership_questionnaire_evaluation', 'waives_membership_required'],
		['join_waitlist', 'overrides_max_attendees'],
		['wait_for_open_spot', 'overrides_max_attendees']
	])('offers the claim for %s when the token sets %s', (step, waiver) => {
		expect(shouldOfferTokenClaim(withWaiver(waiver), step)).toBe(true);
	});

	it.each<[NextStep, string]>([
		['complete_questionnaire', 'waives_membership_required'],
		['become_member', 'waives_questionnaire'],
		['join_waitlist', 'waives_questionnaire']
	])('does not offer the claim for %s when the token only sets %s', (step, waiver) => {
		expect(shouldOfferTokenClaim(withWaiver(waiver), step)).toBe(false);
	});

	it('does not offer the claim for a waivable step without a payload', () => {
		expect(shouldOfferTokenClaim(base, 'complete_questionnaire')).toBe(false);
	});

	it('does not offer the claim when the waiver is not exactly true', () => {
		const token = { ...base, invitation_payload: { waives_questionnaire: 'true' } };
		expect(shouldOfferTokenClaim(token, 'complete_questionnaire')).toBe(false);
	});

	it.each<NextStep>(['complete_profile', 'purchase_ticket', 'rsvp', 'choose_another_tier'])(
		'does not offer the claim for %s, which no waiver clears',
		(step) => {
			const token = {
				...base,
				invitation_payload: {
					waives_questionnaire: true,
					waives_purchase: true,
					waives_membership_required: true,
					overrides_max_attendees: true
				}
			};
			expect(shouldOfferTokenClaim(token, step)).toBe(false);
		}
	);

	it('does not offer a waiver claim when the token has no uses left', () => {
		const token = withWaiver('waives_questionnaire', { uses: 30, max_uses: 30 });
		expect(shouldOfferTokenClaim(token, 'complete_questionnaire')).toBe(false);
	});

	it('offers a waiver claim when the token has uses left or no limit', () => {
		expect(
			shouldOfferTokenClaim(
				withWaiver('waives_questionnaire', { uses: 11, max_uses: 30 }),
				'complete_questionnaire'
			)
		).toBe(true);
		expect(
			shouldOfferTokenClaim(
				withWaiver('waives_questionnaire', { uses: 99, max_uses: 0 }),
				'complete_questionnaire'
			)
		).toBe(true);
	});

	it('never offers the claim for a token that grants no invitation', () => {
		const token = withWaiver('waives_questionnaire', { grants_invitation: false });
		expect(shouldOfferTokenClaim(token, null)).toBe(false);
		expect(shouldOfferTokenClaim(token, 'complete_questionnaire')).toBe(false);
	});

	it('never offers the claim without a token', () => {
		expect(shouldOfferTokenClaim(null, 'request_invitation')).toBe(false);
		expect(shouldOfferTokenClaim(undefined, null)).toBe(false);
	});
});
