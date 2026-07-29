/**
 * Server-side data loading shared by the `/embed` routes.
 *
 * Every call here is deliberately ANONYMOUS: no `Authorization` header, no
 * visibility tokens. An embed renders on a stranger's website, so it must only
 * ever show what a logged-out visitor could see. The backend's
 * `discoverable_for_user()` gating does the rest — list embeds therefore hide
 * UNLISTED events, while a direct single-event embed can still show one
 * (consistent with "has the link", the decision recorded in #689).
 */

import { eventpublicticketsListTiers } from '$lib/api';
import { minimumTierPrice, type EmbedPrice } from '$lib/embed/pricing';
import { EMBED_PRICE_TIMEOUT_MS } from '$lib/embed/constants';
import { log } from '$lib/server/logger';
import type { EventInListSchema } from '$lib/api/generated/types.gen';

/** The subset of an event this module needs — keeps callers free to pass either schema. */
type PriceableEvent = Pick<EventInListSchema, 'id' | 'requires_ticket'>;

/**
 * Cheapest entry price per event, for the "from €X" hint on embed cards.
 *
 * One request per ticketed event, all in flight together and all optional: a
 * failing tiers call drops that card's price rather than the whole embed. Each
 * carries its own `EMBED_PRICE_TIMEOUT_MS` deadline, because `allSettled` still
 * waits for every promise — a hanging upstream would otherwise hold the SSR
 * response open. Events that do not require a ticket are skipped outright, so a
 * page of RSVP-only events costs nothing extra.
 *
 * The caller bounds the fan-out by clamping `page_size`
 * (`EMBED_MAX_PAGE_SIZE`), which is what keeps a third-party page from turning
 * one embed request into an unbounded burst against the public API.
 */
export async function loadEmbedPrices(
	fetch: typeof globalThis.fetch,
	events: readonly PriceableEvent[]
): Promise<Record<string, EmbedPrice>> {
	const ticketed = events.filter((event) => event.requires_ticket);
	if (ticketed.length === 0) return {};

	const results = await Promise.allSettled(
		ticketed.map(async (event) => {
			const { data } = await eventpublicticketsListTiers({
				fetch,
				path: { event_id: event.id },
				signal: AbortSignal.timeout(EMBED_PRICE_TIMEOUT_MS)
			});
			return { id: event.id, price: minimumTierPrice(data ?? []) };
		})
	);

	const prices: Record<string, EmbedPrice> = {};
	for (const result of results) {
		if (result.status === 'rejected') {
			log.warning('embed_tiers_fetch_failed', { error: result.reason });
			continue;
		}
		if (result.value.price) prices[result.value.id] = result.value.price;
	}
	return prices;
}
