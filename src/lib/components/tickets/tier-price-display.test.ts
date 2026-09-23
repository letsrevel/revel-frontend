import { describe, it, expect } from 'vitest';
import type { TicketTierSchema, TierSeatPricingSchema } from '$lib/api/generated/types.gen';
import { tierPriceDisplay } from './tier-price-display';
import { formatMoney, formatMoneyRange } from '$lib/utils/format';
import * as m from '$lib/paraglide/messages.js';

const eur = (amount: number): string => formatMoney(amount, 'EUR');
const eurRange = (min: number, max: number): string => formatMoneyRange(min, max, 'EUR');

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
		expect(tierPriceDisplay(tier(), flat)).toBe(eur(20));
		// en locale: symbol-first, never the "EUR 20.00" code template (#949)
		expect(tierPriceDisplay(tier(), flat)).toBe('€20.00');
	});

	it('renders the PWYC range', () => {
		expect(tierPriceDisplay(tier(), { ...flat, isPwyc: true, minAmount: 5, maxAmount: 15 })).toBe(
			eurRange(5, 15)
		);
	});

	it('renders the category range for any category-priced tier (single pricing mechanism)', () => {
		expect(tierPriceDisplay(tier({ seat_pricing: pricing }), flat)).toBe(eurRange(20, 55));
	});

	it('ignores unavailable categories when computing the range', () => {
		const only: TierSeatPricingSchema = {
			...pricing,
			categories: (pricing.categories ?? []).slice(1)
		};
		expect(tierPriceDisplay(tier({ seat_pricing: only }), flat)).toBe(eur(20));
	});

	it('excludes a null unpainted fallback (mapped best-available: no unpainted seat is buyable)', () => {
		const mapped: TierSeatPricingSchema = {
			categories: [
				{ id: 'gold', name: 'Gold', color: '#f9b233', price: '80.00', available: true },
				{ id: 'silver', name: 'Silver', color: '#9ab2ff', price: '45.00', available: true }
			],
			unpainted: null
		};
		expect(tierPriceDisplay(tier({ seat_pricing: mapped }), flat)).toBe(eurRange(45, 80));
	});

	it('renders an open-ended PWYC range with the "any amount" label', () => {
		expect(tierPriceDisplay(tier(), { ...flat, isPwyc: true, minAmount: 5, maxAmount: null })).toBe(
			`${eur(5)} \u2013 ${m['ticketConfirmationDialog.anyAmount']()}`
		);
	});

	it('falls back to tier.price when seat_pricing is absent', () => {
		expect(tierPriceDisplay(tier(), flat)).toBe(eur(20));
		expect(tierPriceDisplay(tier({ seat_pricing: null }), flat)).toBe(eur(20));
	});
});
