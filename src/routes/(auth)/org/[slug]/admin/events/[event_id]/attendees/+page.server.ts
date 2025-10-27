import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { eventGetEvent, eventadminListRsvps } from '$lib/api';

export const load: PageServerLoad = async ({ parent, params, locals, fetch, url }) => {
	const parentData = await parent();
	const { organization } = parentData;
	const user = locals.user;

	if (!user) {
		throw error(401, 'You must be logged in to manage attendees');
	}

	const headers: HeadersInit = {
		Authorization: `Bearer ${user.accessToken}`
	};

	// Load event to verify ownership and check if it requires tickets
	let event;
	try {
		const eventResponse = await eventGetEvent({
			fetch,
			path: { event_id: params.event_id },
			headers
		});

		if (!eventResponse.data) {
			throw error(404, 'Event not found');
		}

		event = eventResponse.data;
	} catch (err) {
		if (typeof err === 'object' && err !== null && 'status' in err) {
			const status = (err as { status: number }).status;

			if (status === 404) {
				throw error(404, 'Event not found');
			}

			if (status === 403) {
				throw error(403, 'You do not have permission to manage this event');
			}
		}

		if (err && typeof err === 'object' && 'status' in err && 'body' in err) {
			throw err;
		}

		console.error('Error loading event:', err);
		throw error(500, 'Failed to load event');
	}

	// Verify event belongs to this organization
	if (event.organization?.slug !== organization.slug) {
		throw error(403, 'Event does not belong to this organization');
	}

	// For now, only allow RSVP management for non-ticketed events
	if (event.requires_ticket) {
		throw error(
			400,
			'This event requires tickets. Ticket management is not yet available in this interface.'
		);
	}

	// Get query parameters for filtering
	const status = url.searchParams.get('status') || undefined;
	const search = url.searchParams.get('search') || undefined;
	const page = parseInt(url.searchParams.get('page') || '1');
	const pageSize = 100; // Fixed page size

	// Load RSVPs with filters
	let rsvps: any[] = [];
	let totalCount = 0;
	let nextPage: string | null = null;
	let previousPage: string | null = null;

	try {
		const rsvpResponse = await eventadminListRsvps({
			fetch,
			path: { event_id: params.event_id },
			query: {
				status: status as any,
				search,
				page,
				page_size: pageSize
			},
			headers
		});

		if (!rsvpResponse.data) {
			throw new Error('Failed to load RSVPs');
		}

		rsvps = rsvpResponse.data.results || [];
		totalCount = rsvpResponse.data.count || 0;
		nextPage = rsvpResponse.data.next;
		previousPage = rsvpResponse.data.previous;
	} catch (err) {
		console.error('Error loading RSVPs:', err);
		// Don't fail completely, just return empty list
		rsvps = [];
	}

	return {
		event,
		rsvps,
		totalCount,
		nextPage,
		previousPage,
		currentPage: page,
		pageSize,
		filters: {
			status,
			search
		}
	};
};
