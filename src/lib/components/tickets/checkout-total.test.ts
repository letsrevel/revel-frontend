import { describe, it, expect } from 'vitest';
import type {
	ChartSectorSchema,
	TicketTierSchema,
	VenueChartSchema
} from '$lib/api/generated/types.gen';
import { checkoutTotal, type CheckoutTotalArgs } from './checkout-total';

function tier(overrides: Partial<TicketTierSchema> = {}): CheckoutTotalArgs['tier'] {
	return {
		payment_method: 'offline',
		price_type: 'fixed',
		price: '20.00',
		seat_assignment_mode: 'none',
		seat_pricing: null,
		...overrides
	} as CheckoutTotalArgs['tier'];
}

const chart: VenueChartSchema = {
	venue_id: 'v1',
	venue_name: 'Hall',
	updated_at: null,
	price_categories: [],
	sectors: [
		{
			id: 's1',
			name: 'Stalls',
			kind: 'seated',
			seats: [
				{ id: 'a1', label: 'A1', price_category_id: 'gold' },
				{ id: 'b1', label: 'B1', price_category_id: null }
			]
		} as ChartSectorSchema
	]
};

const pricing = {
	categories: [{ id: 'gold', name: 'Gold', color: '#f9b233', price: '55.00', available: true }],
	unpainted: '20.00'
};

function args(overrides: Partial<CheckoutTotalArgs> = {}): CheckoutTotalArgs {
	return {
		tier: tier(),
		quantity: 1,
		heldSeatIds: [],
		chart: null,
		selectedZoneId: null,
		pwycAmount: '',
		discountedPrice: null,
		...overrides
	};
}

describe('checkoutTotal', () => {
	it('multiplies the flat price by quantity', () => {
		expect(checkoutTotal(args({ quantity: 3 }))).toBe('60.00');
	});

	it('prefers the discounted unit price when applied', () => {
		expect(checkoutTotal(args({ quantity: 2, discountedPrice: '15.50' }))).toBe('31.00');
	});

	it('is 0.00 for free tiers regardless of quantity', () => {
		expect(checkoutTotal(args({ tier: tier({ payment_method: 'free' }), quantity: 4 }))).toBe(
			'0.00'
		);
	});

	it('uses the entered PWYC amount, null while invalid or empty', () => {
		const pwyc = tier({ price_type: 'pwyc' });
		expect(checkoutTotal(args({ tier: pwyc, quantity: 2, pwycAmount: '12.50' }))).toBe('25.00');
		expect(checkoutTotal(args({ tier: pwyc, pwycAmount: '' }))).toBeNull();
		expect(checkoutTotal(args({ tier: pwyc, pwycAmount: 'abc' }))).toBeNull();
	});

	it('sums held seats for a category-priced user_choice tier (server-resolved prices)', () => {
		const uc = tier({ seat_assignment_mode: 'user_choice', seat_pricing: pricing });
		expect(checkoutTotal(args({ tier: uc, chart, heldSeatIds: ['a1', 'b1'] }))).toBe('75.00');
		// No seats held yet: no honest number, show nothing.
		expect(checkoutTotal(args({ tier: uc, chart, heldSeatIds: [] }))).toBeNull();
	});

	it('multiplies the chosen zone price for a mapped best-available tier', () => {
		const ba = tier({
			seat_assignment_mode: 'best_available',
			seat_pricing: { ...pricing, unpainted: null }
		});
		expect(checkoutTotal(args({ tier: ba, quantity: 2, selectedZoneId: 'gold' }))).toBe('110.00');
		// Zone not chosen yet: gated confirm, no number.
		expect(checkoutTotal(args({ tier: ba, quantity: 2 }))).toBeNull();
	});

	it('falls back to the flat price for an UNMAPPED best-available tier', () => {
		const ba = tier({ seat_assignment_mode: 'best_available', seat_pricing: null });
		expect(checkoutTotal(args({ tier: ba, quantity: 2 }))).toBe('40.00');
	});

	it('stays exact on cent arithmetic (integer cents, no float drift)', () => {
		expect(checkoutTotal(args({ tier: tier({ price: '0.10' }), quantity: 3 }))).toBe('0.30');
	});
});
