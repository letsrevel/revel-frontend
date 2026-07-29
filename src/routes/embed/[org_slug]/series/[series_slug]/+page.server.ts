import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { eventseriesGetEventSeriesBySlugs, eventpublicdiscoveryListEvents } from '$lib/api';
import { parseEmbedListFilters } from '$lib/embed/params';
import { loadEmbedPrices } from '$lib/server/embed-data';
import { log } from '$lib/server/logger';

/**
 * Series embed: the series header plus its events.
 *
 * Anonymous like every embed load, so the series must be publicly visible and
 * the event list is the discoverable subset only.
 */
export const load: PageServerLoad = async ({ params, url, fetch }) => {
	const { org_slug, series_slug } = params;
	const filters = parseEmbedListFilters(url.searchParams);

	const seriesResponse = await eventseriesGetEventSeriesBySlugs({
		fetch,
		path: { org_slug, series_slug }
	});

	const series = seriesResponse.data;
	if (!series) {
		error(404, 'Event series not found');
	}

	const eventsResponse = await eventpublicdiscoveryListEvents({
		fetch,
		query: {
			event_series: series.id,
			tags: filters.tags,
			city_id: filters.cityId,
			event_type: filters.eventType,
			include_past: filters.includePast,
			order_by: filters.orderBy,
			page: 1,
			page_size: filters.pageSize
		}
	});

	if (eventsResponse.error) {
		log.warning('embed_series_events_fetch_failed', {
			error: eventsResponse.error,
			seriesId: series.id
		});
	}

	const events = eventsResponse.data?.results ?? [];

	return {
		series,
		events,
		prices: await loadEmbedPrices(fetch, events)
	};
};
