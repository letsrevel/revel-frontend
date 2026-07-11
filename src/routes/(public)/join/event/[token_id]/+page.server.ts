import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { eventpublicdiscoveryGetEventTokenDetails } from '$lib/api/generated/sdk.gen';
import type { EventTokenRejectionSchema } from '$lib/api/generated/types.gen';
import { extractErrorMessage } from '$lib/utils/errors';

export const load: PageServerLoad = async ({ params }) => {
	const tokenId = params.token_id;

	// Fetch token details (no auth required)
	const response = await eventpublicdiscoveryGetEventTokenDetails({
		path: { token_id: tokenId }
	});

	// An EXISTING but unservable token answers 410 with a reason + display
	// fields (revel-backend#681) — render guidance instead of a dead 404.
	if (response.response?.status === 410 && response.error) {
		return {
			token: null,
			rejection: response.error as unknown as EventTokenRejectionSchema,
			tokenId
		};
	}

	if (response.error || !response.data) {
		const errorMessage = extractErrorMessage(response.error, 'Token not found or expired');
		throw error(404, errorMessage);
	}

	return {
		token: response.data,
		rejection: null,
		tokenId
	};
};
