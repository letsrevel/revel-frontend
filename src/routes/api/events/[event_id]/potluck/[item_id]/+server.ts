import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { potluckUpdatePotluckItem5A2Cc5Ea, potluckDeletePotluckItem957A382B } from '$lib/api';

/**
 * PATCH /api/events/[event_id]/potluck/[item_id]
 * Update a potluck item
 */
export const PATCH: RequestHandler = async ({ request, params, locals }) => {
	if (!locals.user?.accessToken) {
		throw error(401, 'Unauthorized');
	}

	try {
		const body = await request.json();

		const response = await potluckUpdatePotluckItem5A2Cc5Ea({
			path: { event_id: params.event_id, item_id: params.item_id },
			body: {
				name: body.name,
				item_type: body.item_type,
				quantity: body.quantity || undefined,
				note: body.note || undefined
			},
			headers: {
				Authorization: `Bearer ${locals.user.accessToken}`
			}
		});

		if (!response.data) {
			throw error(500, 'Failed to update potluck item');
		}

		return json(response.data);
	} catch (err) {
		console.error('Error updating potluck item:', err);
		throw error(500, 'Failed to update potluck item');
	}
};

/**
 * DELETE /api/events/[event_id]/potluck/[item_id]
 * Delete a potluck item
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user?.accessToken) {
		throw error(401, 'Unauthorized');
	}

	try {
		await potluckDeletePotluckItem957A382B({
			path: { event_id: params.event_id, item_id: params.item_id },
			headers: {
				Authorization: `Bearer ${locals.user.accessToken}`
			}
		});

		return json({ success: true });
	} catch (err) {
		console.error('Error deleting potluck item:', err);
		throw error(500, 'Failed to delete potluck item');
	}
};
