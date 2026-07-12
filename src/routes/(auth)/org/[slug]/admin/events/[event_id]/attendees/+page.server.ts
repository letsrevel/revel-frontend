import { error, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import type { PageServerLoad } from './$types';
import { eventpublicdetailsGetEvent, eventadminrsvpsListRsvps } from '$lib/api';
import type { RsvpDetailSchema } from '$lib/api/generated/types.gen';
import { log } from '$lib/server/logger';

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

	// Attendees (RSVP) management is only for non-ticketed events. If a stale or
	// mislabeled link sends a ticketed event here, redirect to its Tickets page
	// instead of dead-ending on a 400.
	if (event.requires_ticket) {
		redirect(302, `/org/${params.slug}/admin/events/${params.event_id}/tickets`);
	}

	// Get query parameters for filtering. `status` is untrusted external input:
	// a comma-separated list of RSVP statuses (`status__in` on the backend).
	// Validate each entry against the allowed statuses and drop anything else
	// (incl. crafted values that would 422 the API and silently empty the list);
	// dedupe while preserving order. An empty result degrades to "all statuses".
	const statusItemSchema = z.enum(['yes', 'no', 'maybe']).optional().catch(undefined);
	const statuses = (url.searchParams.get('status') || '')
		.split(',')
		.map((s) => s.trim())
		.filter((s) => s.length > 0)
		.map((s) => statusItemSchema.parse(s))
		.filter((s): s is 'yes' | 'no' | 'maybe' => s !== undefined)
		.filter((s, i, arr) => arr.indexOf(s) === i);
	const search = url.searchParams.get('search') || undefined;
	const page = parseInt(url.searchParams.get('page') || '1');
	const pageSize = 100; // Fixed page size

	// Load RSVPs with filters
	let rsvps: RsvpDetailSchema[];
	let totalCount = 0;
	let nextPage: string | null = null;
	let previousPage: string | null = null;

	try {
		const rsvpResponse = await eventadminrsvpsListRsvps({
			fetch,
			path: { event_id: params.event_id },
			query: {
				status: statuses.length ? statuses : undefined,
				search,
				page,
				page_size: pageSize,
				include_past: true // Always show RSVPs in admin, even for past events
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
		log.error('rsvps_load_failed', { error: err, eventId: params.event_id });
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
			status: statuses,
			search
		}
	};
};
