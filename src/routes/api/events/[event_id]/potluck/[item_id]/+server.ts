import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { potluckUpdatePotluckItem5A2Cc5Ea, potluckDeletePotluckItem957A382B } from '$lib/api';

/**
 * PATCH /api/events/[event_id]/potluck/[item_id]
 * Update a potluck item
 */
export const PATCH: RequestHandler = async ({ request, params, locals }) => {
	if (!locals.user?.accessToken) {
		console.log('[API/Potluck PATCH] User not authenticated');
		throw error(401, 'Unauthorized');
	}

	try {
		const body = await request.json();
		console.log('[API/Potluck PATCH] Updating item:', {
			event_id: params.event_id,
			item_id: params.item_id,
			user: locals.user.id,
			body
		});

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
			console.error('[API/Potluck PATCH] No data in response:', response);
			throw error(500, 'Failed to update potluck item');
		}

		console.log('[API/Potluck PATCH] Update successful:', {
			item_id: response.data.id,
			is_owned: response.data.is_owned,
			is_assigned: response.data.is_assigned
		});
		return json(response.data);
	} catch (err: any) {
		console.error('[API/Potluck PATCH] Error updating potluck item:', {
			error: err,
			status: err?.response?.status,
			message: err?.message
		});

		// Preserve 403 Forbidden errors
		if (err?.response?.status === 403) {
			throw error(403, 'You do not have permission to edit this item');
		}

		// Preserve 404 Not Found errors
		if (err?.response?.status === 404) {
			throw error(404, 'Potluck item not found');
		}

		throw error(500, 'Failed to update potluck item');
	}
};

/**
 * DELETE /api/events/[event_id]/potluck/[item_id]
 * Delete a potluck item
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user?.accessToken) {
		console.log('[API/Potluck DELETE] User not authenticated');
		throw error(401, 'Unauthorized');
	}

	try {
		console.log('[API/Potluck DELETE] Deleting item:', {
			event_id: params.event_id,
			item_id: params.item_id,
			user: locals.user.id
		});

		await potluckDeletePotluckItem957A382B({
			path: { event_id: params.event_id, item_id: params.item_id },
			headers: {
				Authorization: `Bearer ${locals.user.accessToken}`
			}
		});

		console.log('[API/Potluck DELETE] Delete successful');
		return json({ success: true });
	} catch (err: any) {
		console.error('[API/Potluck DELETE] Error deleting potluck item:', {
			error: err,
			status: err?.response?.status,
			message: err?.message
		});

		// Preserve 403 Forbidden errors
		if (err?.response?.status === 403) {
			throw error(403, 'You do not have permission to delete this item');
		}

		// Preserve 404 Not Found errors
		if (err?.response?.status === 404) {
			throw error(404, 'Potluck item not found');
		}

		throw error(500, 'Failed to delete potluck item');
	}
};
