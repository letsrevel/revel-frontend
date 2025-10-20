import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { potluckClaimPotluckItem, potluckUnclaimPotluckItem } from '$lib/api';

/**
 * POST /api/events/[event_id]/potluck/[item_id]/claim
 * Claim a potluck item
 */
export const POST: RequestHandler = async ({ params, locals }) => {
	if (!locals.user?.accessToken) {
		throw error(401, 'Unauthorized');
	}

	try {
		const response = await potluckClaimPotluckItem({
			path: { event_id: params.event_id, item_id: params.item_id },
			headers: {
				Authorization: `Bearer ${locals.user.accessToken}`
			}
		});

		if (!response.data) {
			throw error(500, 'Failed to claim potluck item');
		}

		return json(response.data);
	} catch (err) {
		console.error('Error claiming potluck item:', err);
		throw error(500, 'Failed to claim potluck item');
	}
};

/**
 * DELETE /api/events/[event_id]/potluck/[item_id]/claim
 * Unclaim a potluck item
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user?.accessToken) {
		throw error(401, 'Unauthorized');
	}

	try {
		const response = await potluckUnclaimPotluckItem({
			path: { event_id: params.event_id, item_id: params.item_id },
			headers: {
				Authorization: `Bearer ${locals.user.accessToken}`
			}
		});

		if (!response.data) {
			throw error(500, 'Failed to unclaim potluck item');
		}

		return json(response.data);
	} catch (err) {
		console.error('Error unclaiming potluck item:', err);
		throw error(500, 'Failed to unclaim potluck item');
	}
};
