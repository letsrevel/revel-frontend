import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { CitySchema } from '$lib/api/generated/types.gen';
import {
	eventpublicdetailsGetEvent,
	userpreferencesGetGeneralPreferences,
	dashboardDashboardEventSeries
} from '$lib/api';
import { log } from '$lib/server/logger';
import * as m from '$lib/paraglide/messages.js';

export const load: PageServerLoad = async ({ parent, params, locals, fetch }) => {
	const parentData = await parent();
	const { organization } = parentData;
	const user = locals.user;

	if (!user) {
		throw error(401, m['serverErrors.adminEvents.loginToEditEvents']());
	}

	const headers: HeadersInit = {
		Authorization: `Bearer ${user.accessToken}`
	};

	// Load event
	let event;
	try {
		const eventResponse = await eventpublicdetailsGetEvent({
			fetch,
			path: { event_id: params.event_id },
			headers
		});

		if (!eventResponse.data) {
			throw error(404, m['serverErrors.common.eventNotFound']());
		}

		event = eventResponse.data;
	} catch (err) {
		// Handle API errors
		if (typeof err === 'object' && err !== null && 'status' in err) {
			const status = (err as { status: number }).status;

			if (status === 404) {
				throw error(404, m['serverErrors.common.eventNotFound']());
			}

			if (status === 403) {
				throw error(403, m['serverErrors.adminEvents.permissionEditEvent']());
			}
		}

		// Re-throw SvelteKit errors
		if (err && typeof err === 'object' && 'status' in err && 'body' in err) {
			throw err;
		}

		log.error('event_load_failed', { error: err, eventId: params.event_id });
		throw error(500, m['serverErrors.common.loadEventFailed']());
	}

	// Verify event belongs to this organization
	if (event.organization?.slug !== organization.slug) {
		throw error(403, m['serverErrors.common.eventWrongOrganization']());
	}

	// Load user preferences for city default
	let userCity: CitySchema | null = null;
	try {
		const preferencesResponse = await userpreferencesGetGeneralPreferences({
			fetch,
			headers
		});
		userCity = preferencesResponse.data?.city || null;
	} catch (err) {
		// Preferences not set or error - that's ok
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

	return {
		event,
		userCity,
		orgCity: organization.city || null,
		eventSeries
	};
};
