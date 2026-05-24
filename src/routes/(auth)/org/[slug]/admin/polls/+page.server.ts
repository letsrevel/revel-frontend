import { error } from '@sveltejs/kit';
import { pollListPolls } from '$lib/api/generated/sdk.gen';
import { extractErrorMessage } from '$lib/utils/errors';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent, fetch }) => {
	const user = locals.user;
	if (!user) {
		throw error(401, 'Unauthorized');
	}

	// Get organization from parent layout
	const { organization } = await parent();

	const response = await pollListPolls({
		fetch,
		query: {
			organization_id: organization.id,
			page: 1,
			page_size: 100
		},
		headers: { Authorization: `Bearer ${user.accessToken}` }
	});

	if (response.error) {
		const status = response.response?.status ?? 500;
		console.error(`Failed to load polls: ${status}`, response.error);
		const message = extractErrorMessage(response.error, 'Failed to load polls');
		throw error(status === 404 ? 404 : status >= 500 ? 500 : 502, message);
	}

	return {
		polls: response.data?.results ?? []
	};
};
