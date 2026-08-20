import { describe, it, expect, vi } from 'vitest';
import { discountApplicable, discountStaysApplied, validateCartDiscount } from './cart-discount';
import type { ValidateDiscountFn } from './cart-discount';
import type { CartGroup } from './cart.svelte';
import type { TierSchemaWithId } from '$lib/types/tickets';
import type { DiscountCodeValidationResponse } from '$lib/api/generated/types.gen';

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

function makeGroup(overrides: Partial<CartGroup> = {}): CartGroup {
	return {
		tier: makeTier(),
		quantity: 1,
		guestNames: [],
		pwycAmount: null,
		priceCategoryId: null,
		accessibleRequired: false,
		seatIds: [],
		...overrides
	};
}

function makeValidationResponse(
	overrides: Partial<DiscountCodeValidationResponse> = {}
): DiscountCodeValidationResponse {
	return {
		valid: true,
		discount_type: 'percentage',
		discount_value: '10',
		discounted_price: '22.50',
		message: null,
		...overrides
	};
}

describe('discountApplicable', () => {
	it('is applicable for an online, fixed-price, unseated tier', () => {
		expect(discountApplicable(makeTier())).toBe(true);
	});

	it('is not applicable for a free tier', () => {
		expect(discountApplicable(makeTier({ payment_method: 'free' }))).toBe(false);
	});

	it('is not applicable for a pwyc tier', () => {
		expect(discountApplicable(makeTier({ price_type: 'pwyc' }))).toBe(false);
	});

	it('is not applicable for a seated tier', () => {
		expect(discountApplicable(makeTier({ seat_assignment_mode: 'user_choice' }))).toBe(false);
	});
});

describe('validateCartDiscount', () => {
	it('fans out only across applicable groups and aggregates results, anyValid true if any group is valid', async () => {
		const applicableA = makeGroup({ tier: makeTier({ id: 'tier-a' }) });
		const applicableB = makeGroup({ tier: makeTier({ id: 'tier-b' }) });
		const freeGroup = makeGroup({ tier: makeTier({ id: 'tier-free', payment_method: 'free' }) });

		const validate: ValidateDiscountFn = vi.fn(async (tierId: string) => {
			if (tierId === 'tier-a') return makeValidationResponse({ valid: false, message: 'nope' });
			if (tierId === 'tier-b') return makeValidationResponse({ valid: true });
			throw new Error('should not be called for inapplicable groups');
		});

		const result = await validateCartDiscount(
			'CODE',
			[applicableA, applicableB, freeGroup],
			validate
		);

		expect(validate).toHaveBeenCalledTimes(2);
		expect(result.byTier.size).toBe(2);
		expect(result.byTier.get('tier-a')?.valid).toBe(false);
		expect(result.byTier.get('tier-a')?.message).toBe('nope');
		expect(result.byTier.get('tier-b')?.valid).toBe(true);
		expect(result.anyValid).toBe(true);
	});

	it('anyValid is false when no applicable group validates as valid', async () => {
		const groupA = makeGroup({ tier: makeTier({ id: 'tier-a' }) });
		const groupB = makeGroup({ tier: makeTier({ id: 'tier-b' }) });

		const validate: ValidateDiscountFn = vi.fn(async () =>
			makeValidationResponse({ valid: false, message: 'invalid code' })
		);

		const result = await validateCartDiscount('BAD', [groupA, groupB], validate);

		expect(result.byTier.size).toBe(2);
		expect(result.anyValid).toBe(false);
	});

	it('tolerates a null (transport error) from one group without failing the others', async () => {
		const groupA = makeGroup({ tier: makeTier({ id: 'tier-a' }) });
		const groupB = makeGroup({ tier: makeTier({ id: 'tier-b' }) });

		const validate: ValidateDiscountFn = vi.fn(async (tierId: string) => {
			if (tierId === 'tier-a') return null;
			return makeValidationResponse({ valid: true });
		});

		const result = await validateCartDiscount('CODE', [groupA, groupB], validate);

		expect(result.byTier.size).toBe(1);
		expect(result.byTier.has('tier-a')).toBe(false);
		expect(result.byTier.get('tier-b')?.valid).toBe(true);
		expect(result.anyValid).toBe(true);
	});

	it('returns an empty map and anyValid false when zero groups are applicable', async () => {
		const freeGroup = makeGroup({ tier: makeTier({ payment_method: 'free' }) });
		const pwycGroup = makeGroup({ tier: makeTier({ price_type: 'pwyc' }) });

		const validate: ValidateDiscountFn = vi.fn();

		const result = await validateCartDiscount('CODE', [freeGroup, pwycGroup], validate);

		expect(validate).not.toHaveBeenCalled();
		expect(result.byTier.size).toBe(0);
		expect(result.anyValid).toBe(false);
	});

	it('calls validate in parallel (Promise.all), not sequentially', async () => {
		const groupA = makeGroup({ tier: makeTier({ id: 'tier-a' }) });
		const groupB = makeGroup({ tier: makeTier({ id: 'tier-b' }) });

		const order: string[] = [];
		const validate: ValidateDiscountFn = vi.fn(async (tierId: string) => {
			order.push(`start-${tierId}`);
			// tier-a resolves slower than tier-b, but both should be *started* before either resolves
			await new Promise((resolve) => setTimeout(resolve, tierId === 'tier-a' ? 10 : 0));
			order.push(`end-${tierId}`);
			return makeValidationResponse({ valid: true });
		});

		await validateCartDiscount('CODE', [groupA, groupB], validate);

		// Both starts happen before either group's promise settles sequentially-blocking.
		expect(order[0]).toBe('start-tier-a');
		expect(order[1]).toBe('start-tier-b');
	});
});

describe('discountStaysApplied', () => {
	it('stays applied when at least one applicable group came back valid', () => {
		const groupA = makeGroup({ tier: makeTier({ id: 'tier-a' }) });
		const groupB = makeGroup({ tier: makeTier({ id: 'tier-b' }) });
		const result = {
			byTier: new Map([
				['tier-a', makeValidationResponse({ valid: false, message: 'nope' })],
				['tier-b', makeValidationResponse({ valid: true })]
			]),
			anyValid: true
		};

		expect(discountStaysApplied(result, [groupA, groupB])).toBe(true);
	});

	it('stays applied when every applicable group is a transport failure (no map entries)', () => {
		const groupA = makeGroup({ tier: makeTier({ id: 'tier-a' }) });
		const groupB = makeGroup({ tier: makeTier({ id: 'tier-b' }) });
		const result = { byTier: new Map(), anyValid: false };

		expect(discountStaysApplied(result, [groupA, groupB])).toBe(true);
	});

	it('clears once there is at least one real invalid response and none valid', () => {
		const groupA = makeGroup({ tier: makeTier({ id: 'tier-a' }) });
		const groupB = makeGroup({ tier: makeTier({ id: 'tier-b' }) });
		const result = {
			byTier: new Map([
				['tier-a', makeValidationResponse({ valid: false, message: 'invalid code' })]
				// tier-b: transport failure, no entry — still a real "no" from tier-a.
			]),
			anyValid: false
		};

		expect(discountStaysApplied(result, [groupA, groupB])).toBe(false);
	});

	it('is false when there are no applicable groups at all', () => {
		const freeGroup = makeGroup({ tier: makeTier({ payment_method: 'free' }) });
		const result = { byTier: new Map(), anyValid: false };

		expect(discountStaysApplied(result, [freeGroup])).toBe(false);
	});
});
