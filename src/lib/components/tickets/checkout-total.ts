/**
 * Running total for the purchase dialogs' sticky footer.
 *
 * The buyer must see what they'll pay AT THE MOMENT the confirm button is
 * reachable — the in-flow estimates can scroll out of view under the seat
 * map, the footer cannot. This mirrors the server's pricing rules without
 * re-deriving any seat price (all per-seat/zone amounts come from the
 * server-resolved `seat_pricing`):
 *
 * - free tier            → '0.00' (the caller renders "Free")
 * - PWYC                 → entered amount × quantity (null while invalid)
 * - user_choice + map    → sum of the held seats' resolved prices
 *                          (null until at least one seat is held)
 * - mapped best_available→ chosen zone's price × quantity (null until chosen)
 * - flat                 → (discounted unit price ?? tier price) × quantity
 *
 * Always integer cents — decimal strings from the backend have ≤2 fraction
 * digits, so this stays exact where float addition wouldn't. A null result
 * means "no honest number yet"; the footer shows nothing rather than a guess.
 * The result is still an ESTIMATE of the charge: discounts on category-priced
 * tiers and VAT resolve server-side at checkout.
 *
 * No runes here — plain functions so this stays unit-testable.
 */
import type { TicketTierSchema, VenueChartSchema } from '$lib/api/generated/types.gen';
import { estimatedSeatTotal } from './seat-pricing';
import { isMappedBestAvailable } from './seat-zones';

export interface CheckoutTotalArgs {
	tier: Pick<
		TicketTierSchema,
		'payment_method' | 'price_type' | 'price' | 'seat_assignment_mode' | 'seat_pricing'
	>;
	quantity: number;
	/** Held seats (user_choice); the chart resolves their painted categories. */
	heldSeatIds: readonly string[];
	chart: VenueChartSchema | null;
	/** Chosen zone on a mapped best-available tier. */
	selectedZoneId: string | null;
	/** Raw PWYC input (used only when price_type is 'pwyc'). */
	pwycAmount: string;
	/** Per-ticket discounted price from validate-discount, when applied. */
	discountedPrice: string | null;
}

function toCents(raw: string | number | null | undefined): number | null {
	if (raw == null) return null;
	const parsed = typeof raw === 'string' ? Number.parseFloat(raw) : raw;
	if (!Number.isFinite(parsed) || parsed < 0) return null;
	return Math.round(parsed * 100);
}

function fromCents(cents: number): string {
	return (cents / 100).toFixed(2);
}

/** Decimal-string total for the current dialog state, or null when unknown. */
export function checkoutTotal(args: CheckoutTotalArgs): string | null {
	const { tier, quantity } = args;
	if (quantity < 1) return null;
	if (tier.payment_method === 'free') return '0.00';

	if (tier.price_type === 'pwyc') {
		const cents = toCents(args.pwycAmount.trim() || null);
		return cents == null ? null : fromCents(cents * quantity);
	}

	if (tier.seat_assignment_mode === 'user_choice' && tier.seat_pricing) {
		return estimatedSeatTotal(tier.seat_pricing, args.chart, args.heldSeatIds);
	}

	if (isMappedBestAvailable(tier)) {
		const zone = (tier.seat_pricing?.categories ?? []).find(
			(category) => category.id === args.selectedZoneId
		);
		const cents = toCents(zone?.price);
		return cents == null ? null : fromCents(cents * quantity);
	}

	const cents = toCents(args.discountedPrice ?? tier.price);
	return cents == null ? null : fromCents(cents * quantity);
}
