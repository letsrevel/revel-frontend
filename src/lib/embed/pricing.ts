/**
 * "from €X" pricing hints for embed cards.
 *
 * Embeds are anonymous, so they use the public tiers endpoint
 * (`GET /api/events/{id}/tickets/tiers`). That endpoint is best-effort for our
 * purposes: if it fails, the card simply renders without a price rather than
 * failing the whole embed.
 */

import type { TicketTierSchema } from '$lib/api/generated/types.gen';

export interface EmbedPrice {
	/** Lowest entry price across the event's tiers. */
	amount: number;
	/** ISO 4217 code of the cheapest tier. */
	currency: string;
}

/**
 * The amount a buyer must pay to enter through a given tier.
 *
 * Pay-what-you-can tiers advertise their *floor* (`pwyc_min`), which is what
 * "from" means for them; a missing/blank floor means they can be claimed for
 * nothing, i.e. zero.
 */
function tierEntryAmount(tier: TicketTierSchema): number | null {
	const raw = tier.price_type === 'pwyc' ? (tier.pwyc_min ?? '0') : tier.price;
	const parsed = Number.parseFloat(raw);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/**
 * Cheapest entry price across the tiers a visitor could actually buy.
 *
 * Tiers the backend has already marked unpurchasable (`can_purchase === false`)
 * are excluded so an embed never advertises a price nobody can take. Returns
 * `null` when there are no tiers at all — the caller renders no price rather
 * than claiming the event is free.
 */
export function minimumTierPrice(tiers: readonly TicketTierSchema[]): EmbedPrice | null {
	let best: EmbedPrice | null = null;

	for (const tier of tiers) {
		if (tier.can_purchase === false) continue;
		const amount = tierEntryAmount(tier);
		if (amount === null) continue;
		if (best === null || amount < best.amount) {
			best = { amount, currency: tier.currency };
		}
	}

	return best;
}
