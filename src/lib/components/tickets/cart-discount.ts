/**
 * Cart-level discount fan-out (#853 PR 2). A single code the buyer types once
 * gets validated against every applicable group's tier in parallel — the
 * backend validates per-tier (BE endpoint takes {event_id, tier_id}), so the
 * cart has to fan a single code out itself.
 */
import type { DiscountCodeValidationResponse } from '$lib/api/generated/types.gen';
import { eventpublicticketsValidateDiscount } from '$lib/api/generated/sdk.gen';
import type { CartGroup } from './cart.svelte';

/** A group a discount code can actually reduce: paid, non-PWYC. Seat mode is
 *  deliberately NOT a factor (#863 review dropped PR 2's temporary seat
 *  clause): the BE applies a validated code to any non-PWYC tier
 *  (batch_ticket_service/context.py::_dc_for), category-priced seats included —
 *  the client's discounted total is then an estimate; checkout is
 *  authoritative. */
export function discountApplicable(tier: CartGroup['tier']): boolean {
	return tier.payment_method !== 'free' && tier.price_type !== 'pwyc';
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

/**
 * Whether a checked code should stay "applied" after `validateCartDiscount`:
 * true when it's valid for some group, OR while ANY applicable group's check
 * failed at the transport layer (a `null` response is "no answer", not
 * "invalid"). Validity is per-tier, so tier A's real "no" says nothing about
 * an unanswered tier B — the code could be valid for exactly that group, and
 * dropping it would strip it before checkout's authoritative validation gets
 * to see it (#863 review). False only once EVERY applicable group has a real
 * response and none of them is valid.
 */
export function discountStaysApplied(result: CartDiscountResult, groups: CartGroup[]): boolean {
	const applicableCount = groups.filter((group) => discountApplicable(group.tier)).length;
	const anyUnanswered = applicableCount > result.byTier.size;
	return result.anyValid || (applicableCount > 0 && anyUnanswered);
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
