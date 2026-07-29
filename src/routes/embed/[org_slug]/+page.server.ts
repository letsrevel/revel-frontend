import type { PageServerLoad } from './$types';
import { eventpublicdiscoveryListEvents } from '$lib/api';
import { parseEmbedListFilters } from '$lib/embed/params';
import { loadEmbedPrices } from '$lib/server/embed-data';
import { log } from '$lib/server/logger';

/**
 * Filtered event list for one organization.
 *
 * A single request: the public event list is filtered by `organization_slug`
 * (backend #822). The discovery filters AND together rather than OR, so the
 * slug narrows the result set — we deliberately never send `organization` (the
 * UUID) alongside it.
 *
 * An unknown or mismatched slug is NOT an error: the filter applies on top of
 * the already-gated `discoverable_for_user()` queryset, so it yields an empty
 * `200`, and the page renders its empty state. That is the right behaviour for
 * a surface living on someone else's website — a mistyped slug should read as
 * "nothing on right now", not as a stack trace in their layout.
 *
 * The organization's display identity comes from the events themselves
 * (`EventInListSchema.organization`); with no events there is nothing to head
 * the list with, so the header is omitted and only the empty state and the
 * footer link render.
 */
export const load: PageServerLoad = async ({ params, url, fetch }) => {
	const { org_slug } = params;
	const filters = parseEmbedListFilters(url.searchParams);

	const eventsResponse = await eventpublicdiscoveryListEvents({
		fetch,
		query: {
			organization_slug: org_slug,
			tags: filters.tags,
			city_id: filters.cityId,
			event_type: filters.eventType,
			event_series: filters.eventSeries,
			include_past: filters.includePast,
			order_by: filters.orderBy,
			page: 1,
			page_size: filters.pageSize
		}
	});

	if (eventsResponse.error) {
		// An embed that renders "no events" is far better than one that renders a
		// stack trace inside someone else's page.
		log.warning('embed_events_fetch_failed', { error: eventsResponse.error, orgSlug: org_slug });
	}

	const events = eventsResponse.data?.results ?? [];

	return {
		orgSlug: org_slug,
		organization: events[0]?.organization ?? null,
		events,
		prices: await loadEmbedPrices(fetch, events)
	};
};
