import { eventpublicdiscoveryListEvents } from '$lib/api/generated/sdk.gen';
import type { PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { extractErrorMessage } from '$lib/utils/errors';
import { log } from '$lib/server/logger';
import { shouldRedirectToSingle, sortTicketEventsForPicker } from '$lib/utils/ticket-event-picker';

export const load: PageServerLoad = async ({ parent, params, locals, fetch }) => {
	const { organization } = await parent();
	const user = locals.user;

	if (!user) {
		throw error(401, 'You must be logged in to manage tickets');
	}

	const headers: HeadersInit = {
		Authorization: `Bearer ${user.accessToken}`
	};

	const eventsResponse = await eventpublicdiscoveryListEvents({
		fetch,
		headers,
		query: {
			organization: organization.id,
			requires_ticket: true,
			include_past: true,
			next_events: false,
			page_size: 100
		}
	});

	if (eventsResponse.error) {
		log.error('admin_tickets_events_load_failed', {
			error: eventsResponse.error,
			orgId: organization.id
		});
		const errorMessage = extractErrorMessage(
			eventsResponse.error,
			'Failed to load ticketed events. Please try again later.'
		);
		throw error(500, errorMessage);
	}

	const events = eventsResponse.data?.results ?? [];

	// Convenience: jump straight to the only ticketed event when it's active.
	const single = shouldRedirectToSingle(events);
	if (single) {
		throw redirect(303, `/org/${params.slug}/admin/events/${single.id}/tickets`);
	}

	return {
		events: sortTicketEventsForPicker(events)
	};
};
