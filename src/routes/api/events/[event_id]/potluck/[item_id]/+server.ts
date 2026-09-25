import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { potluckUpdatePotluckItem, potluckDeletePotluckItem } from '$lib/api';
import { throwIfUpstreamFailed } from '$lib/server/upstream';

/**
 * PATCH /api/events/[event_id]/potluck/[item_id]
 * Update a potluck item
 */
export const PATCH: RequestHandler = async ({ request, params, locals, fetch }) => {
	if (!locals.user?.accessToken) {
		throw error(401, 'Unauthorized');
	}

	const body = await request.json();

	const result = await potluckUpdatePotluckItem({
		path: { event_id: params.event_id, item_id: params.item_id },
		body: {
			name: body.name,
			item_type: body.item_type,
			quantity: body.quantity || undefined,
			note: body.note || undefined
		},
		headers: {
			Authorization: `Bearer ${locals.user.accessToken}`
		},
		fetch
	});
	throwIfUpstreamFailed('potluck_update_failed', result, 'Failed to update potluck item', {
		request_id: locals.requestId,
		event_id: params.event_id,
		item_id: params.item_id
	});

	return json(result.data);
};

/**
 * DELETE /api/events/[event_id]/potluck/[item_id]
 * Delete a potluck item
 */
export const DELETE: RequestHandler = async ({ params, locals, fetch }) => {
	if (!locals.user?.accessToken) {
		throw error(401, 'Unauthorized');
	}

	const result = await potluckDeletePotluckItem({
		path: { event_id: params.event_id, item_id: params.item_id },
		headers: {
			Authorization: `Bearer ${locals.user.accessToken}`
		},
		fetch
	});
	throwIfUpstreamFailed('potluck_delete_failed', result, 'Failed to delete potluck item', {
		request_id: locals.requestId,
		event_id: params.event_id,
		item_id: params.item_id
	});

	return json({ success: true });
};
