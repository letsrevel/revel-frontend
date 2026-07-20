/**
 * Headline price string for the purchase dialogs' tier card.
 *
 * For a category-priced user_choice tier (#668) a single `tier.price` would be
 * dishonest — the buyer pays the price of the seat they pick — so the display
 * becomes the server-resolved range across sellable categories plus the
 * unpainted fallback. Flat/PWYC/free tiers keep their existing wording.
 *
 * No runes here — plain function so this stays unit-testable.
 */
import * as m from '$lib/paraglide/messages.js';
import type { TicketTierSchema } from '$lib/api/generated/types.gen';

export interface TierPriceDisplayFlags {
	isFree: boolean;
	isPwyc: boolean;
	isUserChoiceSeat: boolean;
	/** PWYC bounds, already parsed by the dialog. */
	minAmount: number;
	maxAmount: number | null;
}

export function tierPriceDisplay(tier: TicketTierSchema, flags: TierPriceDisplayFlags): string {
	if (flags.isFree) return m['ticketConfirmationDialog.free']();
	if (flags.isPwyc) {
		const maxDisplay = flags.maxAmount
			? `${tier.currency} ${flags.maxAmount.toFixed(2)}`
			: m['ticketConfirmationDialog.anyAmount']();
		return `${tier.currency} ${flags.minAmount.toFixed(2)} - ${maxDisplay}`;
	}
	if (flags.isUserChoiceSeat && tier.seat_pricing) {
		const prices = [
			...(tier.seat_pricing.categories ?? [])
				.filter((c) => c.available !== false && c.price != null)
				.map((c) => parseFloat(c.price as string)),
			parseFloat(tier.seat_pricing.unpainted)
		].filter((p) => Number.isFinite(p));
		if (prices.length > 0) {
			const min = Math.min(...prices);
			const max = Math.max(...prices);
			if (min !== max) {
				return `${tier.currency} ${min.toFixed(2)} - ${tier.currency} ${max.toFixed(2)}`;
			}
			return `${tier.currency} ${min.toFixed(2)}`;
		}
	}
	const price = typeof tier.price === 'string' ? parseFloat(tier.price) : tier.price;
	return `${tier.currency} ${price.toFixed(2)}`;
}
