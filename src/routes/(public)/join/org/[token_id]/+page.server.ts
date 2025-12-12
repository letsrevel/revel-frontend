import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { organizationGetOrganizationTokenDetails } from '$lib/api/generated/sdk.gen';
import { extractErrorMessage } from '$lib/utils/errors';

export const load: PageServerLoad = async ({ params }) => {
	const tokenId = params.token_id;

	// Fetch token details (no auth required)
	const response = await organizationGetOrganizationTokenDetails({
		path: { token_id: tokenId }
	});

	if (response.error || !response.data) {
		const errorMessage = extractErrorMessage(response.error, 'Token not found or expired');
		throw error(404, errorMessage);
	}

	return {
		token: response.data
	};
};
