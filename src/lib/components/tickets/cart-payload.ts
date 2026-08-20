/**
 * Pure builders mapping the EventCart onto the multi-tier checkout payload
 * (BE #846). One CheckoutGroupSchema per CartGroup. The tickets array reuses
 * buildPurchaseTicketItems so name/seat semantics stay byte-identical with the
 * legacy single-tier flow (the resume fingerprint depends on it).
 */
import type { CheckoutGroupSchema, BuyerBillingInfoSchema } from '$lib/api/generated/types.gen';
import type { CartGroup } from './cart.svelte';
import type { CartCheckoutParams } from '../events/cart-checkout-controller.svelte';
import { buildPurchaseTicketItems } from './purchase-items';

export interface CartPayloadOptions {
	requireTicketNames: boolean;
	/** Buyer's fallback holder name (defaultGuestName(userName)). */
	defaultName: string;
}

export function buildCartItems(
	groups: CartGroup[],
	opts: CartPayloadOptions
): CheckoutGroupSchema[] {
	return groups.map((group) => {
		const names = Array.from({ length: group.quantity }, (_, i) => group.guestNames[i] ?? '');
		const item: CheckoutGroupSchema = {
			tier_id: group.tier.id,
			tickets: buildPurchaseTicketItems({
				guestNames: names,
				requireTicketNames: opts.requireTicketNames,
				namesShown: opts.requireTicketNames,
				defaultName: opts.defaultName,
				heldSeatIds: group.seatIds,
				useHeldSeats: group.seatIds.length > 0
			})
		};
		if (group.tier.price_type === 'pwyc' && group.pwycAmount != null) {
			item.pwyc_amount = Number.parseFloat(group.pwycAmount);
		}
		if (group.priceCategoryId) item.price_category_id = group.priceCategoryId;
		if (group.accessibleRequired) item.accessible_required = true;
		return item;
	});
}

/**
 * Construct a CartCheckoutParams object with normalized, undefined-safe values.
 *
 * Normalizes discountCode (trim, empty → undefined) and billingInfo (null →
 * undefined), ensuring the fingerprint never varies between ''/"  " and
 * undefined. Key order is fixed (items, discountCode, billingInfo) so
 * JSON.stringify() always produces byte-identical output for equivalent inputs.
 */
export function buildCartCheckoutParams(
	items: CheckoutGroupSchema[],
	discountCode: string,
	billingInfo: BuyerBillingInfoSchema | null
): CartCheckoutParams {
	const trimmedCode = discountCode.trim() || undefined;
	const normalizedBilling = billingInfo ?? undefined;

	// Build result with strict key order: items first, then optional discountCode, then optional billingInfo
	const result: CartCheckoutParams = { items };
	if (trimmedCode !== undefined) result.discountCode = trimmedCode;
	if (normalizedBilling !== undefined) result.billingInfo = normalizedBilling;
	return result;
}
