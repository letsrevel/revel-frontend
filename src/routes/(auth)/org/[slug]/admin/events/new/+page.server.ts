import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import type { CitySchema } from '$lib/api/generated/types.gen';
import { userpreferencesGetGeneralPreferences, dashboardDashboardEventSeries } from '$lib/api';
import { log } from '$lib/server/logger';

export const load: PageServerLoad = async ({ parent, locals, fetch, url }) => {
	const parentData = await parent();
	const { organization, canCreateEvent } = parentData;
	const user = locals.user;

	if (!user) {
		throw error(401, 'You must be logged in to create events');
	}

	if (!canCreateEvent) {
		throw error(403, 'You do not have permission to create events for this organization');
	}

	const headers: HeadersInit = {
		Authorization: `Bearer ${user.accessToken}`
	};

	// Load user preferences for city default
	let userCity: CitySchema | null = null;
	try {
		const preferencesResponse = await userpreferencesGetGeneralPreferences({
			fetch,
			headers
		});
		userCity = preferencesResponse.data?.city || null;
	} catch (err) {
		// Preferences not set or error - that's ok, we'll use organization city
		log.debug('user_preferences_load_failed', { error: err });
	}

	// Load organization's event series for dropdown
	const eventSeries = [];
	try {
		const seriesResponse = await dashboardDashboardEventSeries({
			fetch,
			headers
		});
		// API returns paginated response with results array
		if (seriesResponse.data && 'results' in seriesResponse.data) {
			eventSeries.push(...seriesResponse.data.results);
		}
	} catch (err) {
		// No series yet or error - that's ok
		log.debug('event_series_load_failed', { error: err });
	}

	// Prefill hooks. Driven by `?start=<ISO>&event_series_id=<UUID>` query
	// params (e.g. from the ExdatesChipList "Create one-off event for this
	// date" chip action on the recurring-series dashboard). The EventEditor
	// component seeds these into its initial form state in create mode only;
	// both are optional and null when absent.
	const initialStart = url.searchParams.get('start');
	const initialEventSeriesId = url.searchParams.get('event_series_id');

	return {
		userCity,
		orgCity: organization.city || null,
		eventSeries,
		initialStart,
		initialEventSeriesId
	};
};
