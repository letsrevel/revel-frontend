import { eventListEvents } from '$lib/api/generated/sdk.gen';
import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { extractErrorMessage } from '$lib/utils/errors';

export const load: PageServerLoad = async ({ parent, locals, fetch }) => {
	const { organization, canCreateEvent } = await parent();
	const user = locals.user;

	if (!user) {
		throw error(401, 'You must be logged in to view events');
	}

	const headers: HeadersInit = {
		Authorization: `Bearer ${user.accessToken}`
	};

	// Get all events for this organization (including past events)
	const eventsResponse = await eventListEvents({
		fetch,
		headers,
		query: {
			organization: organization.id, // Use UUID, not slug
			include_past: true, // Include past events in queryset
			next_events: false, // Don't filter to only upcoming events (default is true)
			page_size: 100 // TODO: Add pagination
		}
	});

	// Handle API errors
	if (eventsResponse.error) {
		console.error('[Admin Events Load] Failed to fetch events:', eventsResponse.error);
		const errorMessage = extractErrorMessage(
			eventsResponse.error,
			'Failed to load events. Please try again later.'
		);
		throw error(500, errorMessage);
	}

	if (!eventsResponse.data) {
		throw error(500, 'Failed to load events');
	}

	return {
		events: eventsResponse.data.results || [],
		canCreateEvent
	};
};
