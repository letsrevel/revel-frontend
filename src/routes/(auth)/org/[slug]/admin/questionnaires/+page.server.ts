import { questionnaireListOrgQuestionnaires } from '$lib/api/generated/sdk.gen';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { extractErrorMessage } from '$lib/utils/errors';

export const load: PageServerLoad = async ({ locals, parent, fetch }) => {
	const user = locals.user;
	if (!user) {
		throw error(401, 'Unauthorized');
	}

	// Get organization from parent layout
	const { organization } = await parent();

	// Fetch questionnaires filtered by this organization
	const response = await questionnaireListOrgQuestionnaires({
		fetch,
		query: {
			organization_id: organization.id
		},
		headers: { Authorization: `Bearer ${user.accessToken}` }
	});

	if (response.error) {
		console.error('Failed to load questionnaires:', response.error);
		const errorMessage = extractErrorMessage(response.error, 'Failed to load questionnaires');
		throw error(500, errorMessage);
	}

	return {
		questionnaires: response.data?.results || [],
		accessToken: user.accessToken
	};
};
