import { error } from '@sveltejs/kit';
import { questionnaireGetOrgQuestionnaire } from '$lib/api/generated/sdk.gen';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const user = locals.user;

	if (!user) {
		throw error(401, 'Unauthorized');
	}

	try {
		// Fetch the organization questionnaire with all details
		const response = await questionnaireGetOrgQuestionnaire({
			path: { org_questionnaire_id: params.id },
			headers: { Authorization: `Bearer ${user.accessToken}` }
		});

		if (response.error) {
			throw error(404, 'Questionnaire not found');
		}

		const questionnaire = response.data;

		// We need to get the organization ID from somewhere
		// Since we have the slug, let's fetch the organization or use parent layout data
		// For now, we'll need to add this to the layout or pass it differently
		// The organizationId will come from the parent layout

		// Return questionnaire data
		return {
			questionnaire,
			organizationSlug: params.slug
		};
	} catch (err) {
		console.error('Failed to load questionnaire:', err);
		throw error(404, 'Questionnaire not found');
	}
};
