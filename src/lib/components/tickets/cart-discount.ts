/**
 * Cart-level discount fan-out (#853 PR 2). A single code the buyer types once
 * gets validated against every applicable group's tier in parallel — the
 * backend validates per-tier (BE endpoint takes {event_id, tier_id}), so the
 * cart has to fan a single code out itself.
 */
import type { DiscountCodeValidationResponse } from '$lib/api/generated/types.gen';
import { eventpublicticketsValidateDiscount } from '$lib/api/generated/sdk.gen';
import type { CartGroup } from './cart.svelte';

/** A group a discount code can actually reduce client-side: flat-priced, paid.
 *  PR 2 carts are unseated anyway; keep the seat clause for PR 3 safety. */
export function discountApplicable(tier: CartGroup['tier']): boolean {
	return (
		tier.payment_method !== 'free' &&
		tier.price_type !== 'pwyc' &&
		tier.seat_assignment_mode === 'none'
	);
}

export interface CartDiscountResult {
	/** Applicable groups only, keyed by tier id. */
	byTier: Map<string, DiscountCodeValidationResponse>;
	anyValid: boolean;
}

export type ValidateDiscountFn = (
	tierId: string,
	code: string
) => Promise<DiscountCodeValidationResponse | null>;

/**
 * Fans one code out across the cart's applicable groups. Injected fn for
 * testability; the real one (`makeValidateDiscountFn`) wraps
 * eventpublicticketsValidateDiscount and returns null on transport error — a
 * failed call is "no answer", not "invalid", so it contributes no map entry
 * and never fails the other groups (each call is isolated, not Promise.all-
 * rejecting).
 */
export async function validateCartDiscount(
	code: string,
	groups: CartGroup[],
	validate: ValidateDiscountFn
): Promise<CartDiscountResult> {
	const applicable = groups.filter((group) => discountApplicable(group.tier));

	const results = await Promise.all(
		applicable.map(async (group) => {
			const tierId = group.tier.id;
			const response = await validate(tierId, code);
			return { tierId, response };
		})
	);

	const byTier = new Map<string, DiscountCodeValidationResponse>();
	let anyValid = false;
	for (const { tierId, response } of results) {
		if (response === null) continue;
		byTier.set(tierId, response);
		if (response.valid) anyValid = true;
	}

	return { byTier, anyValid };
}

/** Real ValidateDiscountFn wrapping the generated SDK call for a fixed event. */
export function makeValidateDiscountFn(eventId: string): ValidateDiscountFn {
	return async (tierId: string, code: string) => {
		try {
			const response = await eventpublicticketsValidateDiscount({
				path: { event_id: eventId, tier_id: tierId },
				body: { code }
			});
			return response.data ?? null;
		} catch {
			return null;
		}
	};
}
