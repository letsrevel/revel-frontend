import { describe, it, expect } from 'vitest';
import { discountOnlyFreeTiers, discountCurrencyUnused } from './discount';

const free = { id: 'f', payment_method: 'free', price_type: 'fixed', currency: 'EUR' };
const pwyc = { id: 'p', payment_method: 'online', price_type: 'pwyc', currency: 'EUR' };
const paid = { id: 'o', payment_method: 'online', price_type: 'fixed', currency: 'EUR' };
const base = {
	seriesSelected: false,
	tiersLoaded: true,
	eventTiers: [free, pwyc],
	selectedTiers: []
};

describe('G1a discountOnlyFreeTiers', () => {
	it('warns when every tier is free or pwyc', () => {
		const w = discountOnlyFreeTiers(base);
		expect(w?.id).toBe('G1a');
		expect(w?.level).toBe('warn');
		expect(w?.title()).toBe('Code applies to free tiers only');
	});
	it('is silent when one tier is paid', () => {
		expect(discountOnlyFreeTiers({ ...base, eventTiers: [free, paid] })).toBeNull();
	});
	it('uses the union: a paid selected tier counts', () => {
		expect(discountOnlyFreeTiers({ ...base, selectedTiers: [paid] })).toBeNull();
		expect(
			discountOnlyFreeTiers({ ...base, eventTiers: [], selectedTiers: [free] })
		).not.toBeNull();
	});
	it('does not double count a tier in both lists', () => {
		expect(
			discountOnlyFreeTiers({ ...base, eventTiers: [free], selectedTiers: [free] })
		).not.toBeNull();
	});
	it('is silent when a series is selected', () => {
		expect(discountOnlyFreeTiers({ ...base, seriesSelected: true })).toBeNull();
	});
	it('is silent while tiers load, and for an empty tier list', () => {
		expect(discountOnlyFreeTiers({ ...base, tiersLoaded: false })).toBeNull();
		expect(discountOnlyFreeTiers({ ...base, eventTiers: [], selectedTiers: [] })).toBeNull();
	});
});

describe('G1b discountCurrencyUnused', () => {
	const input = {
		...base,
		eventTiers: [paid],
		discount_type: 'fixed_amount',
		currency: 'USD'
	};
	it('warns when no tier uses the code currency', () => {
		const w = discountCurrencyUnused(input);
		expect(w?.id).toBe('G1b');
		expect(w?.level).toBe('warn');
	});
	it('is silent when a tier uses it, case-insensitively', () => {
		expect(discountCurrencyUnused({ ...input, currency: 'EUR' })).toBeNull();
		expect(discountCurrencyUnused({ ...input, currency: 'eur' })).toBeNull();
	});
	it('is silent when tiers are selected (the backend uses the tier currency)', () => {
		expect(discountCurrencyUnused({ ...input, selectedTiers: [paid] })).toBeNull();
	});
	it('is silent for a percentage code or an empty currency', () => {
		expect(discountCurrencyUnused({ ...input, discount_type: 'percentage' })).toBeNull();
		expect(discountCurrencyUnused({ ...input, currency: '' })).toBeNull();
		expect(discountCurrencyUnused({ ...input, currency: null })).toBeNull();
	});
	it('is silent when a series is selected, tiers load, or the list is empty', () => {
		expect(discountCurrencyUnused({ ...input, seriesSelected: true })).toBeNull();
		expect(discountCurrencyUnused({ ...input, tiersLoaded: false })).toBeNull();
		expect(discountCurrencyUnused({ ...input, eventTiers: [] })).toBeNull();
	});
});
