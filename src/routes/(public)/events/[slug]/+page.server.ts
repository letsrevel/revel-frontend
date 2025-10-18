import { error } from '@sveltejs/kit';
import { eventGetEventBySlugs1A75C6Ea, eventGetMyEventStatusEb40C7Df } from '$lib/api';
import type { PageServerLoad } from './$types';
import type { UserEventStatus } from '$lib/utils/eligibility';

export const load: PageServerLoad = async ({ params, locals, fetch }) => {
	const { slug } = params;

	// TODO: For now, we need both org_slug and event_slug
	// We'll need to adjust the route structure to match /org/[org_slug]/events/[event_slug]
	// For testing, extract org from event slug if formatted as "org-slug--event-slug"
	const parts = slug.split('--');
	const org_slug = parts[0] || slug;
	const event_slug = parts[1] || slug;

	try {
		// Fetch event details (public, SSR for SEO)
		const eventResponse = await eventGetEventBySlugs1A75C6Ea({
			fetch,
			path: { org_slug, event_slug }
		});

		if (!eventResponse.data) {
			throw error(404, 'Event not found');
		}

		const event = eventResponse.data;

		// If user is authenticated, fetch their status
		let userStatus: UserEventStatus | null = null;

		if (locals.user) {
			try {
				const statusResponse = await eventGetMyEventStatusEb40C7Df({
					fetch,
					path: { event_id: event.id }
				});

				if (statusResponse.data) {
					userStatus = statusResponse.data;
				}
			} catch (err) {
				// If user status fails, continue without it
				// This is not critical - user can still view the event
				console.error('Failed to fetch user event status:', err);
			}
		}

		return {
			event,
			userStatus
		};
	} catch (err) {
		// Handle different error types
		if (typeof err === 'object' && err !== null && 'status' in err) {
			const status = (err as { status: number }).status;

			if (status === 404) {
				throw error(404, 'Event not found');
			}

			if (status === 403) {
				throw error(403, 'You do not have permission to view this event');
			}
		}

		// Generic error
		console.error('Error loading event:', err);
		throw error(500, 'Failed to load event details');
	}
};
