import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { eventGetEventTokenDetails } from '$lib/api/generated/sdk.gen';

export const load: PageServerLoad = async ({ params }) => {
	const tokenId = params.token_id;

	// Fetch token details (no auth required)
	const response = await eventGetEventTokenDetails({
		path: { token_id: tokenId }
	});

	if (response.error || !response.data) {
		throw error(404, 'Token not found or expired');
	}

	return {
		token: response.data
	};
};
