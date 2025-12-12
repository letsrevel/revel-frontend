import { eventseriesListEventSeries } from '$lib/api/generated/sdk.gen';
import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { extractErrorMessage } from '$lib/utils/errors';

export const load: PageServerLoad = async ({ parent, locals, fetch }) => {
	const { organization } = await parent();
	const user = locals.user;

	if (!user) {
		throw error(401, 'You must be logged in to view event series');
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
		console.error('[Admin Event Series Load] Failed to fetch series:', seriesResponse.error);
		const errorMessage = extractErrorMessage(
			seriesResponse.error,
			'Failed to load event series. Please try again later.'
		);
		throw error(500, errorMessage);
	}

	if (!seriesResponse.data) {
		throw error(500, 'Failed to load event series');
	}

	return {
		series: seriesResponse.data.results || []
	};
};
