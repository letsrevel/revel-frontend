import { error } from '@sveltejs/kit';
import { pollListPolls } from '$lib/api/generated/sdk.gen';
import { extractErrorMessage } from '$lib/utils/errors';
import { log } from '$lib/server/logger';
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
		log.error('polls_list_failed', { status, error: response.error });
		const message = extractErrorMessage(response.error, 'Failed to load polls');
		// Preserve upstream client-error statuses (401/403/404/410/422) so auth
		// and permission failures surface correctly; normalize 5xx / transport
		// failures to 500.
		throw error(status >= 400 && status < 500 ? status : 500, message);
	}

	return {
		polls: response.data?.results ?? []
	};
};
