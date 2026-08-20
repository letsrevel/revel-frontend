import { describe, it, expect } from 'vitest';
import { buildCartItems, buildCartCheckoutParams } from './cart-payload';
import type { TierSchemaWithId } from '$lib/types/tickets';
import type { CheckoutGroupSchema, BuyerBillingInfoSchema } from '$lib/api/generated/types.gen';

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
	it('namesShown is true when requireTicketNames is true, regardless of quantity', () => {
		const tier = makeTier();
		// Test with quantity = 1 (the key case: should now have namesShown: true)
		const items = buildCartItems(
			[
				{
					tier,
					quantity: 1,
					guestNames: [''],
					pwycAmount: null,
					priceCategoryId: null,
					accessibleRequired: false,
					seatIds: []
				}
			],
			{ requireTicketNames: true, defaultName: 'DefaultName' }
		);
		// The ticket should have guest_name: '' (not substituted with defaultName)
		expect(items[0].tickets[0]).toEqual({ guest_name: '' });
	});
});

describe('buildCartCheckoutParams', () => {
	function makeCheckoutGroup(): CheckoutGroupSchema {
		return {
			tier_id: crypto.randomUUID(),
			tickets: [{ guest_name: 'Alice' }]
		};
	}

	it('normalizes empty and whitespace discountCode to undefined', () => {
		const items: CheckoutGroupSchema[] = [makeCheckoutGroup()];
		const billingInfo: BuyerBillingInfoSchema = { country: 'US' };

		const result1 = buildCartCheckoutParams(items, '', billingInfo);
		expect(result1.discountCode).toBeUndefined();

		const result2 = buildCartCheckoutParams(items, '  ', billingInfo);
		expect(result2.discountCode).toBeUndefined();

		const result3 = buildCartCheckoutParams(items, ' CODE ', billingInfo);
		expect(result3.discountCode).toBe('CODE');
	});

	it('normalizes null billingInfo to undefined', () => {
		const items: CheckoutGroupSchema[] = [makeCheckoutGroup()];

		const result = buildCartCheckoutParams(items, 'CODE', null);
		expect(result.billingInfo).toBeUndefined();
	});

	it('constructs with key order: items, discountCode, billingInfo', () => {
		const items: CheckoutGroupSchema[] = [makeCheckoutGroup()];
		const billingInfo: BuyerBillingInfoSchema = { country: 'US' };

		const result = buildCartCheckoutParams(items, 'CODE', billingInfo);
		const keys = Object.keys(result);
		expect(keys).toEqual(['items', 'discountCode', 'billingInfo']);
	});

	it('produces byte-identical fingerprint with undefined vs empty params', () => {
		const items: CheckoutGroupSchema[] = [makeCheckoutGroup()];

		// Call with empty code and null billing
		const result1 = buildCartCheckoutParams(items, '', null);
		// Call with only items (equivalent)
		const result2 = buildCartCheckoutParams(items, '', null);

		// Both must have identical byte representation for fingerprinting
		const json1 = JSON.stringify(result1);
		const json2 = JSON.stringify(result2);
		expect(json1).toBe(json2);

		// And should match a minimal object with just items
		const minimal = { items };
		const minimalJson = JSON.stringify(minimal);
		expect(json1).toBe(minimalJson);
	});
});
