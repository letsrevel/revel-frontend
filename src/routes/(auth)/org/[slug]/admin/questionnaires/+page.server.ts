import { questionnaireListOrgQuestionnaires } from '$lib/api/generated/sdk.gen';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user;
	if (!user) {
		throw error(401, 'Unauthorized');
	}

	// Fetch questionnaires for this organization
	const response = await questionnaireListOrgQuestionnaires({
		headers: { Authorization: `Bearer ${user.accessToken}` }
	});

	if (response.error) {
		console.error('Failed to load questionnaires:', response.error);
		throw error(500, 'Failed to load questionnaires');
	}

	return {
		questionnaires: response.data?.results || []
	};
};
