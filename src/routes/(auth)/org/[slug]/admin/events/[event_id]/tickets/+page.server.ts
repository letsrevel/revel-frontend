import { error, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import type { PageServerLoad } from './$types';
import {
	eventpublicdetailsGetEvent,
	eventadminticketsListTickets,
	eventadminticketsGetEventRevenue
} from '$lib/api';
import { parseTicketOrderBy } from '$lib/components/tickets/ticket-sort';
import type { EventRevenueSchema } from '$lib/api/generated/types.gen';
import { log } from '$lib/server/logger';

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
		const eventResponse = await eventpublicdetailsGetEvent({
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

		log.error('event_load_failed', { error: err, eventId: params.event_id });
		throw error(500, 'Failed to load event');
	}

	// Verify event belongs to this organization
	if (event.organization?.slug !== organization.slug) {
		throw error(403, 'Event does not belong to this organization');
	}

	// This page is only for ticketed events. If a stale or mislabeled link sends a
	// non-ticketed (RSVP) event here, redirect to its Attendees page instead of
	// dead-ending on a 400.
	if (!event.requires_ticket) {
		redirect(302, `/org/${params.slug}/admin/events/${params.event_id}/attendees`);
	}

	// Get query parameters for filtering
	const status = url.searchParams.get('status') || undefined;
	const paymentMethod = url.searchParams.get('payment_method') || undefined;
	const search = url.searchParams.get('search') || undefined;
	const orderBy = parseTicketOrderBy(url.searchParams.get('order_by'));
	// Validate the untrusted `page` param: coerce to a positive integer, falling
	// back to 1 for missing/garbage values (avoids sending NaN to the API).
	const page = z.coerce
		.number()
		.int()
		.min(1)
		.catch(1)
		.parse(url.searchParams.get('page') || '1');
	const pageSize = 100; // Fixed page size

	// Whole-event revenue aggregate (independent of the current page / filters).
	// Loaded in parallel with the ticket list; failures degrade to null.
	const revenuePromise: Promise<EventRevenueSchema | null> = eventadminticketsGetEventRevenue({
		fetch,
		path: { event_id: params.event_id },
		headers
	})
		.then((res) => res.data ?? null)
		.catch((err) => {
			log.error('event_revenue_load_failed', { error: err, eventId: params.event_id });
			return null;
		});

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
				order_by: orderBy,
				page,
				page_size: pageSize,
				include_past: true // Always show tickets in admin, even for past events
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
		log.error('tickets_load_failed', { error: err, eventId: params.event_id });
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
		revenue: await revenuePromise,
		filters: {
			status,
			paymentMethod,
			search,
			orderBy
		}
	};
};
