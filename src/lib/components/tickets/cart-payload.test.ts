import { describe, it, expect } from 'vitest';
import { buildCartItems } from './cart-payload';
import type { TierSchemaWithId } from '$lib/types/tickets';

function makeTier(overrides: Partial<TierSchemaWithId> = {}): TierSchemaWithId {
	return {
		id: overrides.id ?? crypto.randomUUID(),
		name: 'GA',
		payment_method: 'online',
		price_type: 'fixed',
		seat_assignment_mode: 'none',
		currency: 'EUR',
		price: '25.00',
		total_available: 100,
		...overrides
	} as TierSchemaWithId;
}

describe('buildCartItems', () => {
	it('emits one group per tier with N empty tickets when names are off', () => {
		const tier = makeTier();
		const items = buildCartItems(
			[
				{
					tier,
					quantity: 2,
					guestNames: [],
					pwycAmount: null,
					priceCategoryId: null,
					accessibleRequired: false,
					seatIds: []
				}
			],
			{ requireTicketNames: false, defaultName: 'Alice' }
		);
		expect(items).toEqual([{ tier_id: tier.id, tickets: [{}, {}] }]);
	});
	it('emits pwyc_amount only for pwyc tiers, zone/accessible only when set', () => {
		const pwyc = makeTier({ price_type: 'pwyc' });
		const items = buildCartItems(
			[
				{
					tier: pwyc,
					quantity: 1,
					guestNames: [],
					pwycAmount: '15.00',
					priceCategoryId: null,
					accessibleRequired: true,
					seatIds: []
				}
			],
			{ requireTicketNames: false, defaultName: '' }
		);
		expect(items[0].pwyc_amount).toBe(15);
		expect(items[0].accessible_required).toBe(true);
		expect(items[0]).not.toHaveProperty('price_category_id');
	});
	it('carries names and positional seat ids when present', () => {
		const tier = makeTier({ seat_assignment_mode: 'user_choice' });
		const items = buildCartItems(
			[
				{
					tier,
					quantity: 2,
					guestNames: ['Alice', ''],
					pwycAmount: null,
					priceCategoryId: null,
					accessibleRequired: false,
					seatIds: ['s1', 's2']
				}
			],
			{ requireTicketNames: true, defaultName: 'Buyer' }
		);
		expect(items[0].tickets).toEqual([
			{ guest_name: 'Alice', seat_id: 's1' },
			{ guest_name: '', seat_id: 's2' }
		]);
	});
});
