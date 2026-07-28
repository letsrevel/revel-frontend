import { describe, it, expect } from 'vitest';
import { extractPurchaseErrorMessage } from './purchase-error';
import type { EventUserEligibility } from '$lib/api/generated/types.gen';
import * as m from '$lib/paraglide/messages.js';

const EVENT_ID = '11111111-1111-1111-1111-111111111111';
const FALLBACK = 'generic fallback';

const membershipTierRefusal: EventUserEligibility = {
	allowed: false,
	event_id: EVENT_ID,
	reason: 'This ticket tier requires a specific membership tier.',
	reason_code: 'membership_tier_required',
	next_step: 'upgrade_membership'
};

describe('extractPurchaseErrorMessage', () => {
	it('keeps reading plain { detail } bodies', () => {
		expect(extractPurchaseErrorMessage({ detail: 'Sold out.' }, FALLBACK)).toBe('Sold out.');
	});

	it('reads an eligibility refusal off an SDK envelope, which carries no detail', () => {
		expect(
			extractPurchaseErrorMessage({ response: { data: membershipTierRefusal } }, FALLBACK)
		).toBe(m['eligibility.reason.membership_tier_required']());
	});

	it('reads an eligibility refusal thrown as the raw body', () => {
		expect(extractPurchaseErrorMessage(membershipTierRefusal, FALLBACK)).toBe(
			m['eligibility.reason.membership_tier_required']()
		);
	});

	it('reads an eligibility refusal carried as an Error cause', () => {
		const wrapped = new Error(m['eligibility.reason.membership_tier_required'](), {
			cause: membershipTierRefusal
		});
		expect(extractPurchaseErrorMessage(wrapped, FALLBACK)).toBe(
			m['eligibility.reason.membership_tier_required']()
		);
	});

	it('falls back for unrecognised errors', () => {
		expect(extractPurchaseErrorMessage({}, FALLBACK)).toBe(FALLBACK);
		expect(extractPurchaseErrorMessage(null, FALLBACK)).toBe(FALLBACK);
	});
});
