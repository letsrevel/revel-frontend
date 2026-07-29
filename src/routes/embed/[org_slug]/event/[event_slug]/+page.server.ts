import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { eventpublicdetailsGetEventBySlugs, eventpublicticketsListTiers } from '$lib/api';
import { minimumTierPrice, type EmbedPrice } from '$lib/embed/pricing';
import { log } from '$lib/server/logger';

/**
 * Single-event embed.
 *
 * Fetched anonymously, so visibility is exactly what a logged-out visitor with
 * the link would see: PUBLIC and UNLISTED events render, everything narrower
 * 404s. That is the decision recorded in #689 — a direct single-event embed is
 * the equivalent of sharing the link, whereas the list embed (which is a
 * discovery surface) hides UNLISTED.
 */
export const load: PageServerLoad = async ({ params, fetch }) => {
	const { org_slug, event_slug } = params;

	const eventResponse = await eventpublicdetailsGetEventBySlugs({
		fetch,
		path: { org_slug, event_slug }
	});

	const event = eventResponse.data;
	if (!event) {
		error(404, 'Event not found');
	}

	let priceFrom: EmbedPrice | null = null;
	if (event.requires_ticket) {
		try {
			const tiersResponse = await eventpublicticketsListTiers({
				fetch,
				path: { event_id: event.id }
			});
			priceFrom = minimumTierPrice(tiersResponse.data ?? []);
		} catch (err) {
			// Pricing is a nice-to-have; never fail the embed over it.
			log.warning('embed_event_tiers_fetch_failed', { error: err, eventId: event.id });
		}
	}

	return { event, priceFrom };
};
