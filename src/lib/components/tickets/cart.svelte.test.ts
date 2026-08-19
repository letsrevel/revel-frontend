import { describe, it, expect } from 'vitest';
import { EventCart, quickBuyEligible, MAX_TICKETS_PER_GROUP } from './cart.svelte';
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
const noLimits = { remainingFor: () => undefined, eventRemaining: () => null };

describe('quickBuyEligible', () => {
	it('accepts fixed-price unseated tiers when names are off', () => {
		expect(quickBuyEligible(makeTier(), false)).toBe(true);
	});
	it('rejects when names required / pwyc / seated / hidden', () => {
		expect(quickBuyEligible(makeTier(), true)).toBe(false);
		expect(quickBuyEligible(makeTier({ price_type: 'pwyc' }), false)).toBe(false);
		expect(quickBuyEligible(makeTier({ seat_assignment_mode: 'user_choice' }), false)).toBe(false);
		expect(quickBuyEligible(makeTier({ seat_assignment_mode: 'best_available' }), false)).toBe(
			false
		);
		expect(quickBuyEligible(makeTier({ payment_method: 'hidden' }), false)).toBe(false);
	});
});

describe('EventCart', () => {
	it('adds, updates, and removes groups via setQuantity', () => {
		const cart = new EventCart(noLimits);
		const tier = makeTier();
		cart.setQuantity(tier, 2);
		expect(cart.totalCount).toBe(2);
		expect(cart.groupFor(tier.id)?.quantity).toBe(2);
		cart.setQuantity(tier, 3);
		expect(cart.quantityFor(tier.id)).toBe(3);
		cart.setQuantity(tier, 0);
		expect(cart.isEmpty).toBe(true);
	});
	it('caps quantity at min(total_available, per-tier remaining, 50)', () => {
		const tier = makeTier({ total_available: 4 });
		const cart = new EventCart({
			remainingFor: () => ({ tier_id: tier.id, remaining: 3, sold_out: false, can_purchase: true }),
			eventRemaining: () => null
		});
		expect(cart.maxQuantity(tier)).toBe(3);
		cart.setQuantity(tier, 10);
		expect(cart.quantityFor(tier.id)).toBe(3);
		expect(cart.maxQuantity(makeTier({ total_available: null }))).toBe(MAX_TICKETS_PER_GROUP);
	});
	it('falls back to tier.max_tickets_per_user when my-status has no per-tier info (first-time buyer, eligibility shape)', () => {
		const cart = new EventCart(noLimits); // remainingFor always undefined
		expect(cart.maxQuantity(makeTier({ max_tickets_per_user: 2 }))).toBe(2);
		// info present with remaining: null means UNLIMITED — no fallback
		const unlimited = makeTier({ max_tickets_per_user: 2 });
		const cart2 = new EventCart({
			remainingFor: () => ({
				tier_id: unlimited.id,
				remaining: null,
				sold_out: false,
				can_purchase: true
			}),
			eventRemaining: () => null
		});
		expect(cart2.maxQuantity(unlimited)).toBe(MAX_TICKETS_PER_GROUP);
	});
	it('shares the event budget across tiers (BE #901)', () => {
		const cart = new EventCart({ remainingFor: () => undefined, eventRemaining: () => 3 });
		const a = makeTier();
		const b = makeTier();
		cart.setQuantity(a, 2);
		expect(cart.maxQuantity(b)).toBe(1); // 3 − 2 already in cart
		expect(cart.maxQuantity(a)).toBe(3); // own quantity doesn't double-count
	});
	it('blocks mixed currency and mixed payment method', () => {
		const cart = new EventCart(noLimits);
		cart.setQuantity(makeTier({ currency: 'EUR', payment_method: 'online' }), 1);
		expect(cart.joinBlock(makeTier({ currency: 'USD' }))).toBe('currency');
		expect(cart.joinBlock(makeTier({ payment_method: 'at_the_door' }))).toBe('payment_method');
		expect(cart.joinBlock(makeTier())).toBe(null);
		const blocked = makeTier({ currency: 'USD' });
		cart.setQuantity(blocked, 2);
		expect(cart.groupFor(blocked.id)).toBeUndefined(); // setQuantity refuses blocked tiers
	});
	it('clear() empties the cart', () => {
		const cart = new EventCart(noLimits);
		cart.setQuantity(makeTier(), 2);
		cart.clear();
		expect(cart.isEmpty).toBe(true);
	});
});
