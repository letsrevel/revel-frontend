import * as m from '$lib/paraglide/messages.js';
import { questionnaireListOrgQuestionnaires } from '$lib/api/generated/sdk.gen';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { extractErrorMessage } from '$lib/utils/errors';
import { log } from '$lib/server/logger';

export const load: PageServerLoad = async ({ locals, parent, fetch }) => {
	const user = locals.user;
	if (!user) {
		throw error(401, m['serverErrors.common.unauthorized']());
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
		log.error('questionnaires_list_failed', { error: response.error });
		const errorMessage = extractErrorMessage(
			response.error,
			m['serverErrors.admin.loadQuestionnairesFailed']()
		);
		throw error(500, errorMessage);
	}

	return {
		questionnaires: response.data?.results || []
	};
};
