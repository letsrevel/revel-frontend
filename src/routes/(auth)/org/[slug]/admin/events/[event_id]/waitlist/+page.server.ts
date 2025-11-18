import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { eventadminListWaitlist } from '$lib/api';

export const load: PageServerLoad = async ({ params, locals, fetch }) => {
	const user = locals.user;

	if (!user) {
		throw error(401, 'You must be logged in to manage waitlist');
	}

	const headers: HeadersInit = {
		Authorization: `Bearer ${user.accessToken}`
	};

	// Load initial waitlist data
	try {
		const response = await eventadminListWaitlist({
			fetch,
			path: { event_id: params.event_id },
			query: { page: 1, page_size: 20 },
			headers
		});

		if (response.error) {
			throw error(500, 'Failed to load waitlist');
		}

		return {
			waitlistData: response.data,
			eventId: params.event_id
		};
	} catch (err) {
		console.error('Failed to load waitlist:', err);
		if (typeof err === 'object' && err !== null && 'status' in err) {
			const status = (err as { status: number }).status;

			if (status === 404) {
				throw error(404, 'Event not found');
			}

			if (status === 403) {
				throw error(403, 'You do not have permission to manage this event');
			}
		}

		throw error(500, 'Failed to load waitlist');
	}
};
