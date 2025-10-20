import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { potluckListPotluckItems, potluckCreatePotluckItem } from '$lib/api';

/**
 * GET /api/events/[event_id]/potluck
 * List all potluck items for an event
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user?.accessToken) {
		throw error(401, 'Unauthorized');
	}

	try {
		const response = await potluckListPotluckItems({
			path: { event_id: params.event_id },
			headers: {
				Authorization: `Bearer ${locals.user.accessToken}`
			}
		});

		if (!response.data) {
			throw error(500, 'Failed to fetch potluck items');
		}

		return json(response.data);
	} catch (err) {
		console.error('Error fetching potluck items:', err);
		throw error(500, 'Failed to fetch potluck items');
	}
};

/**
 * POST /api/events/[event_id]/potluck
 * Create a new potluck item
 */
export const POST: RequestHandler = async ({ request, params, locals }) => {
	if (!locals.user?.accessToken) {
		throw error(401, 'Unauthorized');
	}

	try {
		const body = await request.json();

		const response = await potluckCreatePotluckItem({
			path: { event_id: params.event_id },
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
			throw error(500, 'Failed to create potluck item');
		}

		return json(response.data);
	} catch (err) {
		console.error('Error creating potluck item:', err);
		throw error(500, 'Failed to create potluck item');
	}
};
