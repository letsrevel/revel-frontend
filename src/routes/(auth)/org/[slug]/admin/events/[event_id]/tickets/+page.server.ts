import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { eventGetEvent, eventadminticketsListTickets } from '$lib/api';

export const load: PageServerLoad = async ({ parent, params, locals, fetch, url }) => {
	const parentData = await parent();
	const { organization } = parentData;
	const user = locals.user;

	if (!user) {
		throw error(401, 'You must be logged in to manage tickets');
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

	// This page is only for ticketed events
	if (!event.requires_ticket) {
		throw error(
			400,
			'This event does not require tickets. Use the attendees management page for RSVP-based events.'
		);
	}

	// Get query parameters for filtering
	const status = url.searchParams.get('status') || undefined;
	const paymentMethod = url.searchParams.get('payment_method') || undefined;
	const search = url.searchParams.get('search') || undefined;
	const page = parseInt(url.searchParams.get('page') || '1');
	const pageSize = 100; // Fixed page size

	// Load tickets with filters
	let tickets: any[] = [];
	let totalCount = 0;
	let nextPage: string | null = null;
	let previousPage: string | null = null;

	try {
		const ticketsResponse = await eventadminticketsListTickets({
			fetch,
			path: { event_id: params.event_id },
			query: {
				status: status as any,
				tier__payment_method: paymentMethod as any,
				search,
				page,
				page_size: pageSize
			},
			headers
		});

		if (!ticketsResponse.data) {
			throw new Error('Failed to load tickets');
		}

		tickets = ticketsResponse.data.results || [];
		totalCount = ticketsResponse.data.count || 0;
		nextPage = ticketsResponse.data.next;
		previousPage = ticketsResponse.data.previous;
	} catch (err) {
		console.error('Error loading tickets:', err);
		// Don't fail completely, just return empty list
		tickets = [];
	}

	return {
		event,
		tickets,
		totalCount,
		nextPage,
		previousPage,
		currentPage: page,
		pageSize,
		filters: {
			status,
			paymentMethod,
			search
		}
	};
};
