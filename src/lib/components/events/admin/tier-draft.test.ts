import { describe, it, expect, beforeEach } from 'vitest';
import { stashTierDraft, takeTierDraft, stripeGateFor, type TierDraft } from './tier-draft';

const draft: TierDraft = {
	tierId: null,
	name: 'Early bird',
	description: '',
	paymentMethod: 'online',
	priceType: 'fixed',
	price: '12.50',
	pwycMin: '1',
	pwycMax: '',
	currency: 'EUR',
	vatRateOverride: '',
	manualPaymentInstructions: '',
	totalQuantity: '40',
	salesStartAt: '',
	salesEndAt: '',
	maxTicketsPerUser: '',
	visibility: 'public',
	purchasableBy: 'public'
};

describe('tier draft stash', () => {
	beforeEach(() => sessionStorage.clear());

	it('writes under revel:tier-draft:<eventId> and round-trips once', () => {
		stashTierDraft('e1', draft);
		expect(JSON.parse(sessionStorage.getItem('revel:tier-draft:e1') ?? '')).toEqual(draft);
		expect(takeTierDraft('e1')).toEqual(draft);
		expect(sessionStorage.getItem('revel:tier-draft:e1')).toBeNull();
		expect(takeTierDraft('e1')).toBeNull();
	});

	it('is scoped per event', () => {
		stashTierDraft('e1', draft);
		expect(takeTierDraft('e2')).toBeNull();
		expect(sessionStorage.getItem('revel:tier-draft:e1')).not.toBeNull();
	});

	it('ignores corrupted JSON and wrong shapes (and clears them)', () => {
		sessionStorage.setItem('revel:tier-draft:e1', '{not json');
		expect(takeTierDraft('e1')).toBeNull();
		expect(sessionStorage.getItem('revel:tier-draft:e1')).toBeNull();
		sessionStorage.setItem('revel:tier-draft:e1', '"str"');
		expect(takeTierDraft('e1')).toBeNull();
		sessionStorage.setItem('revel:tier-draft:e1', '{"x":1}');
		expect(takeTierDraft('e1')).toBeNull();
	});
});

describe('takeTierDraft purchasableBy validation', () => {
	beforeEach(() => sessionStorage.clear());

	it('keeps every valid value', () => {
		for (const v of [
			'public',
			'members',
			'invited',
			'invited_and_members',
			'non_members'
		] as const) {
			stashTierDraft('e1', { ...draft, purchasableBy: v });
			expect(takeTierDraft('e1')?.purchasableBy).toBe(v);
		}
	});

	it('falls back to public for an unknown value', () => {
		sessionStorage.setItem(
			'revel:tier-draft:e1',
			JSON.stringify({ ...draft, purchasableBy: 'everyone' })
		);
		expect(takeTierDraft('e1')?.purchasableBy).toBe('public');
	});
});

describe('stripeGateFor', () => {
	it('classifies each state', () => {
		expect(stripeGateFor('online', false, false, false)).toBe('connect');
		expect(stripeGateFor('online', false, true, true)).toBe('billing');
		expect(stripeGateFor('online', false, true, false)).toBeNull();
		expect(stripeGateFor('free', false, false, false)).toBeNull();
		expect(stripeGateFor('online', true, false, false)).toBeNull();
	});
});
