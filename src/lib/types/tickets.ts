/**
 * Extended ticket tier schemas with fixes for backend issues
 */

import type { BatchCheckoutPayload, TicketTierSchema } from '$lib/api/generated/types.gen';

/**
 * TicketTierSchema with id field
 *
 * BACKEND NOTE: TicketTierSchema now properly includes all fields including:
 * - 'id' (required for checkout endpoint)
 * - 'manual_payment_instructions' (for offline/at-the-door payments)
 *
 * This type is just an alias for clarity that we're using tiers with IDs.
 */
export type TierSchemaWithId = TicketTierSchema;

/**
 * Type guard to check if a TicketTierSchema has an id
 */
export function hasTierId(tier: TicketTierSchema): tier is TierSchemaWithId {
	return 'id' in tier && typeof (tier as { id?: unknown }).id === 'string';
}

/**
 * Payload the ticket confirmation dialog hands to the purchase path.
 */
export interface TicketConfirmPayload {
	amount?: number;
	tickets: import('$lib/api/generated/types.gen').TicketPurchaseItem[];
	discountCode?: string;
	billingInfo?: import('$lib/api/generated/types.gen').BuyerBillingInfoSchema;
	/** Buyer's zone on a MAPPED best-available tier (mandatory there, absent otherwise). */
	priceCategoryId?: string;
	/** Accessible-seating opt-in (best-available tiers). */
	accessibleRequired?: boolean;
}

/**
 * Best-available seating fields riding on a checkout (pricing convergence):
 * `priceCategoryId` is the buyer's zone — MANDATORY on a mapped best-available
 * tier (non-empty `category_prices`), must be absent otherwise (the backend
 * rejects a zone on an unmapped or non-best-available tier). The checkout must
 * name the same zone as the held block or the backend 409s.
 */
export interface SeatingCheckoutFields {
	priceCategoryId?: string;
	accessibleRequired?: boolean;
}

/**
 * Seating fields for a checkout body. The zone is sent only when the dialog
 * chose one (mapped best-available tier) — the backend 400s on a zone sent to
 * any other tier; `accessible_required` rides along whenever the seated dialog
 * supplied seating fields at all.
 */
export function seatingBodyFields(
	seating: SeatingCheckoutFields | undefined
): Pick<BatchCheckoutPayload, 'price_category_id' | 'accessible_required'> {
	if (!seating) return {};
	return {
		...(seating.priceCategoryId !== undefined
			? { price_category_id: seating.priceCategoryId }
			: {}),
		...(seating.accessibleRequired !== undefined
			? { accessible_required: seating.accessibleRequired }
			: {})
	};
}
