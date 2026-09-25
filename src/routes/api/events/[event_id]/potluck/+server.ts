import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { potluckListPotluckItems, potluckCreatePotluckItem } from '$lib/api';
import { throwIfUpstreamFailed } from '$lib/server/upstream';

/**
 * GET /api/events/[event_id]/potluck
 * List all potluck items for an event
 */
export const GET: RequestHandler = async ({ params, locals, fetch }) => {
	if (!locals.user?.accessToken) {
		throw error(401, 'Unauthorized');
	}

	const result = await potluckListPotluckItems({
		path: { event_id: params.event_id },
		headers: {
			Authorization: `Bearer ${locals.user.accessToken}`
		},
		fetch
	});
	throwIfUpstreamFailed('potluck_list_failed', result, 'Failed to fetch potluck items', {
		request_id: locals.requestId,
		event_id: params.event_id
	});

	return json(result.data);
};

/**
 * POST /api/events/[event_id]/potluck
 * Create a new potluck item
 */
export const POST: RequestHandler = async ({ request, params, locals, fetch }) => {
	if (!locals.user?.accessToken) {
		throw error(401, 'Unauthorized');
	}

	const body = await request.json();

	const result = await potluckCreatePotluckItem({
		path: { event_id: params.event_id },
		body: {
			name: body.name,
			item_type: body.item_type,
			quantity: body.quantity || undefined,
			note: body.note || undefined,
			claim: body.claim ?? false
		},
		headers: {
			Authorization: `Bearer ${locals.user.accessToken}`
		},
		fetch
	});
	throwIfUpstreamFailed('potluck_create_failed', result, 'Failed to create potluck item', {
		request_id: locals.requestId,
		event_id: params.event_id
	});

	return json(result.data);
};
