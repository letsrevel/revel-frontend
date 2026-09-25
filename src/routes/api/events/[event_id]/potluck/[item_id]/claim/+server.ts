import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { potluckClaimPotluckItem, potluckUnclaimPotluckItem } from '$lib/api';
import { throwIfUpstreamFailed } from '$lib/server/upstream';

/**
 * POST /api/events/[event_id]/potluck/[item_id]/claim
 * Claim a potluck item
 */
export const POST: RequestHandler = async ({ params, locals, fetch }) => {
	if (!locals.user?.accessToken) {
		throw error(401, 'Unauthorized');
	}

	const result = await potluckClaimPotluckItem({
		path: { event_id: params.event_id, item_id: params.item_id },
		headers: {
			Authorization: `Bearer ${locals.user.accessToken}`
		},
		fetch
	});
	throwIfUpstreamFailed('potluck_claim_failed', result, 'Failed to claim potluck item', {
		request_id: locals.requestId,
		event_id: params.event_id,
		item_id: params.item_id
	});

	return json(result.data);
};

/**
 * DELETE /api/events/[event_id]/potluck/[item_id]/claim
 * Unclaim a potluck item
 */
export const DELETE: RequestHandler = async ({ params, locals, fetch }) => {
	if (!locals.user?.accessToken) {
		throw error(401, 'Unauthorized');
	}

	const result = await potluckUnclaimPotluckItem({
		path: { event_id: params.event_id, item_id: params.item_id },
		headers: {
			Authorization: `Bearer ${locals.user.accessToken}`
		},
		fetch
	});
	throwIfUpstreamFailed('potluck_unclaim_failed', result, 'Failed to unclaim potluck item', {
		request_id: locals.requestId,
		event_id: params.event_id,
		item_id: params.item_id
	});

	return json(result.data);
};
