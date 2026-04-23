import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	organizationadminrecurringeventsGetSeriesDetail,
	organizationadminrecurringeventsGetSeriesDrift,
	eventpublicdiscoveryListEvents
} from '$lib/api';
import type {
	EventSeriesRecurrenceDetailSchema,
	EventSeriesDriftSchema,
	EventInListSchema
} from '$lib/api/generated/types.gen';

/**
 * Dashboard loader for a recurring series.
 *
 * Parallel-fetches admin detail, drift state, and upcoming occurrences. Drift and
 * upcoming are treated as advisory — a failure there logs and returns an empty
 * fallback instead of blocking the page render. The admin detail is load-bearing;
 * a 404/403 there becomes a SvelteKit error.
 *
 * Past occurrences are fetched lazily on tab click (see `+page.svelte`).
 */
export const load: PageServerLoad = async ({ parent, params, locals, fetch }) => {
	const { organization } = await parent();
	const user = locals.user;

	if (!user) {
		throw error(401, 'You must be logged in to view this series');
	}

	const headers: HeadersInit = {
		Authorization: `Bearer ${user.accessToken}`
	};

	const [detailResult, driftResult, upcomingResult] = await Promise.allSettled([
		organizationadminrecurringeventsGetSeriesDetail({
			fetch,
			path: { slug: organization.slug, series_id: params.series_id },
			headers
		}),
		organizationadminrecurringeventsGetSeriesDrift({
			fetch,
			path: { slug: organization.slug, series_id: params.series_id },
			headers
		}),
		eventpublicdiscoveryListEvents({
			fetch,
			headers,
			query: {
				event_series: params.series_id,
				include_past: false,
				order_by: 'start',
				page_size: 100
			}
		})
	]);

	// Admin detail is required — surface 403/404 clearly.
	if (detailResult.status === 'rejected') {
		const err = detailResult.reason;
		if (typeof err === 'object' && err !== null && 'status' in err) {
			const status = (err as { status: number }).status;
			if (status === 404) throw error(404, 'Event series not found');
			if (status === 403) throw error(403, 'You do not have permission to manage this series');
		}
		console.error('[Series Dashboard] Failed to load series detail:', err);
		throw error(500, 'Failed to load event series');
	}

	const detailResponse = detailResult.value;
	if (detailResponse.error) {
		const status = (detailResponse as { response?: { status?: number } }).response?.status;
		if (status === 404) throw error(404, 'Event series not found');
		if (status === 403) throw error(403, 'You do not have permission to manage this series');
		console.error('[Series Dashboard] Series detail response error:', detailResponse.error);
		throw error(500, 'Failed to load event series');
	}

	const series = detailResponse.data as EventSeriesRecurrenceDetailSchema;

	// Drift is advisory — never fatal. The FE should still render if the drift
	// endpoint blips; the banner simply won't appear this render.
	let drift: EventSeriesDriftSchema = { stale_occurrences: [] };
	if (driftResult.status === 'fulfilled' && !driftResult.value.error && driftResult.value.data) {
		drift = driftResult.value.data;
	} else if (driftResult.status === 'rejected') {
		console.warn('[Series Dashboard] Drift fetch failed; proceeding without drift data.');
	} else if (driftResult.status === 'fulfilled' && driftResult.value.error) {
		console.warn('[Series Dashboard] Drift response error:', driftResult.value.error);
	}

	// Upcoming occurrences likewise non-fatal — show the dashboard with an empty
	// list and let the user retry via the query refetch button.
	let upcoming: EventInListSchema[] = [];
	if (
		upcomingResult.status === 'fulfilled' &&
		!upcomingResult.value.error &&
		upcomingResult.value.data
	) {
		upcoming = upcomingResult.value.data.results || [];
	} else if (upcomingResult.status === 'rejected') {
		console.warn('[Series Dashboard] Upcoming occurrences fetch failed:', upcomingResult.reason);
	} else if (upcomingResult.status === 'fulfilled' && upcomingResult.value.error) {
		console.warn(
			'[Series Dashboard] Upcoming occurrences response error:',
			upcomingResult.value.error
		);
	}

	return {
		seriesId: params.series_id,
		series,
		drift,
		upcoming
	};
};
