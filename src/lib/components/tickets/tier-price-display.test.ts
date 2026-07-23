import { describe, it, expect } from 'vitest';
import type { TicketTierSchema, TierSeatPricingSchema } from '$lib/api/generated/types.gen';
import { tierPriceDisplay } from './tier-price-display';

function tier(overrides: Partial<TicketTierSchema> = {}): TicketTierSchema {
	return {
		id: 'tier-1',
		event_id: 'event-1',
		name: 'Tier',
		price: '20.00',
		currency: 'EUR',
		...overrides
	} as TicketTierSchema;
}

const flat = {
	isFree: false,
	isPwyc: false,
	minAmount: 0,
	maxAmount: null
};

const pricing: TierSeatPricingSchema = {
	categories: [
		{ id: 'gold', name: 'Gold', color: '#f9b233', price: '55.00', available: true },
		{ id: 'late', name: 'Late', color: '#e6332a', price: null, available: false }
	],
	unpainted: '20.00'
};

describe('tierPriceDisplay', () => {
	it('renders the flat price', () => {
		expect(tierPriceDisplay(tier(), flat)).toBe('EUR 20.00');
	});

	it('renders the PWYC range', () => {
		expect(tierPriceDisplay(tier(), { ...flat, isPwyc: true, minAmount: 5, maxAmount: 15 })).toBe(
			'EUR 5.00 - EUR 15.00'
		);
	});

	it('renders the category range for any category-priced tier (single pricing mechanism)', () => {
		expect(tierPriceDisplay(tier({ seat_pricing: pricing }), flat)).toBe('EUR 20.00 - EUR 55.00');
	});

	it('ignores unavailable categories when computing the range', () => {
		const only: TierSeatPricingSchema = {
			...pricing,
			categories: (pricing.categories ?? []).slice(1)
		};
		expect(tierPriceDisplay(tier({ seat_pricing: only }), flat)).toBe('EUR 20.00');
	});

	it('excludes a null unpainted fallback (mapped best-available: no unpainted seat is buyable)', () => {
		const mapped: TierSeatPricingSchema = {
			categories: [
				{ id: 'gold', name: 'Gold', color: '#f9b233', price: '80.00', available: true },
				{ id: 'silver', name: 'Silver', color: '#9ab2ff', price: '45.00', available: true }
			],
			unpainted: null
		};
		expect(tierPriceDisplay(tier({ seat_pricing: mapped }), flat)).toBe('EUR 45.00 - EUR 80.00');
	});

	it('falls back to tier.price when seat_pricing is absent', () => {
		expect(tierPriceDisplay(tier(), flat)).toBe('EUR 20.00');
		expect(tierPriceDisplay(tier({ seat_pricing: null }), flat)).toBe('EUR 20.00');
	});
});
