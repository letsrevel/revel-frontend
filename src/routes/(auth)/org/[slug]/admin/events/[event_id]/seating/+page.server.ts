import { error, isHttpError } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { eventpublicdetailsGetEvent } from '$lib/api';
import { canPerformActionOnEvent } from '$lib/utils/permissions';
import { log } from '$lib/server/logger';

export const load: PageServerLoad = async ({ parent, params, locals, fetch }) => {
	const parentData = await parent();
	const { organization, permissions } = parentData;
	const user = locals.user;

	if (!user) {
		throw error(401, 'You must be logged in to manage seating');
	}

	const headers: HeadersInit = {
		Authorization: `Bearer ${user.accessToken}`
	};

	// Load event to verify it exists and belongs to this organization
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
		if (isHttpError(err)) throw err;
		if (typeof err === 'object' && err !== null && 'status' in err) {
			const status = (err as { status: number }).status;

			if (status === 404) {
				throw error(404, 'Event not found');
			}

			if (status === 403) {
				throw error(403, 'You do not have permission to manage this event');
			}
		}

		log.error('seating_event_load_failed', { error: err, eventId: params.event_id });
		throw error(500, 'Failed to load event');
	}

	if (event.organization?.slug !== organization.slug) {
		throw error(403, 'Event does not belong to this organization');
	}

	// The overrides endpoint is guarded by EventPermission("manage_tickets") on
	// the backend; mirror it here so users without the permission get a 403
	// page instead of a broken form.
	if (!canPerformActionOnEvent(permissions, organization.id, params.event_id, 'manage_tickets')) {
		throw error(403, 'You do not have permission to manage tickets for this event');
	}

	return {
		event,
		eventId: params.event_id
	};
};
