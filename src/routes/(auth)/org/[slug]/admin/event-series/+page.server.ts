import * as m from '$lib/paraglide/messages.js';
import { eventseriesListEventSeries } from '$lib/api/generated/sdk.gen';
import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { extractErrorMessage } from '$lib/utils/errors';
import { log } from '$lib/server/logger';

export const load: PageServerLoad = async ({ parent, locals, fetch }) => {
	const { organization } = await parent();
	const user = locals.user;

	if (!user) {
		throw error(401, m['serverErrors.admin.loginRequiredViewSeriesList']());
	}

	const headers: HeadersInit = {
		Authorization: `Bearer ${user.accessToken}`
	};

	// Get all event series for this organization
	const seriesResponse = await eventseriesListEventSeries({
		fetch,
		headers,
		query: {
			organization: organization.id,
			page_size: 100 // TODO: Add pagination
		}
	});

	// Handle API errors
	if (seriesResponse.error) {
		log.error('event_series_list_failed', { error: seriesResponse.error });
		const errorMessage = extractErrorMessage(
			seriesResponse.error,
			m['serverErrors.admin.loadSeriesListFailed']()
		);
		throw error(500, errorMessage);
	}

	if (!seriesResponse.data) {
		throw error(500, m['serverErrors.common.loadSeriesFailed']());
	}

	return {
		series: seriesResponse.data.results || []
	};
};
