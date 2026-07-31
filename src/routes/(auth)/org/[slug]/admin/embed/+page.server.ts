import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	eventpublicdiscoveryListEvents,
	eventseriesListEventSeries
} from '$lib/api/generated/sdk.gen';
import { log } from '$lib/server/logger';

/**
 * Data for the embed builder: everything an organizer could point an embed at.
 *
 * The pickers are deliberately limited to what an ANONYMOUS visitor can load,
 * because that is all an embed ever is. Offering a draft or members-only event
 * would produce a snippet that renders the embed error page on the organizer's
 * own website — the worst possible place to discover the restriction.
 */
export const load: PageServerLoad = async ({ parent, locals, fetch, url }) => {
	const { organization } = await parent();
	const user = locals.user;

	if (!user) {
		throw error(401, 'You must be logged in to build an embed');
	}

	const headers: HeadersInit = {
		Authorization: `Bearer ${user.accessToken}`
	};

	const [eventsResponse, seriesResponse] = await Promise.all([
		eventpublicdiscoveryListEvents({
			fetch,
			headers,
			query: {
				organization: organization.id,
				include_past: true,
				next_events: false,
				page_size: 100
			}
		}),
		eventseriesListEventSeries({
			fetch,
			headers,
			query: { organization: organization.id, page_size: 100 }
		})
	]);

	// A failed picker is not a failed page: the organization-wide embed — the
	// common case — needs neither list. Degrade to an empty picker and say so.
	if (eventsResponse.error) {
		log.warning('embed_builder_events_load_failed', {
			error: eventsResponse.error,
			orgId: organization.id
		});
	}
	if (seriesResponse.error) {
		log.warning('embed_builder_series_load_failed', {
			error: seriesResponse.error,
			orgId: organization.id
		});
	}

	// PUBLIC and UNLISTED both render in a single-event embed (see the embed
	// event route's own note); anything narrower, or still a draft, 404s.
	const events = (eventsResponse.data?.results ?? [])
		.filter(
			(event) =>
				event.status !== 'draft' &&
				(event.visibility === 'public' || event.visibility === 'unlisted')
		)
		.map((event) => ({ slug: event.slug, name: event.name }));

	const series = (seriesResponse.data?.results ?? []).map((entry) => ({
		slug: entry.slug,
		name: entry.name
	}));

	// `?event=` arrives from the Embed action on an event card. A slug that is
	// not embeddable is reported rather than silently ignored.
	const requestedEventSlug = url.searchParams.get('event');
	const requestedEventEmbeddable =
		!requestedEventSlug || events.some((event) => event.slug === requestedEventSlug);

	return {
		origin: url.origin,
		events,
		series,
		requestedEventSlug,
		requestedEventEmbeddable,
		pickersFailed: Boolean(eventsResponse.error || seriesResponse.error)
	};
};
