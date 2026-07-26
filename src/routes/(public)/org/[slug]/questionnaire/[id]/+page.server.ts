import type { PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import {
	organizationGetOrganization,
	memembershipquestionnaireGetMembershipQuestionnaire
} from '$lib/api';
import { log } from '$lib/server/logger';

export const load: PageServerLoad = async ({ params, locals, fetch }) => {
	const { slug, id: questionnaireId } = params;

	// Auth is optional for the org lookup — a private org is still 404 for guests,
	// and the redirect below sends them to log in either way.
	const headers: HeadersInit = {};
	if (locals.user?.accessToken) {
		headers['Authorization'] = `Bearer ${locals.user.accessToken}`;
	}

	const { data: organization, error: orgError } = await organizationGetOrganization({
		fetch,
		path: { slug },
		headers
	});

	if (orgError || !organization) {
		log.error('membership_questionnaire_org_fetch_failed', { error: orgError, slug });
		throw error(404, 'Organization not found');
	}

	// The membership questionnaire endpoint is authenticated; bounce guests to login
	// and bring them straight back here afterwards.
	if (!locals.user) {
		throw redirect(
			302,
			`/login?returnUrl=${encodeURIComponent(`/org/${slug}/questionnaire/${questionnaireId}`)}`
		);
	}

	// 404s unless this is the org's membership questionnaire (or a tier override) —
	// unrelated org questionnaires are deliberately unreachable here.
	const { data: questionnaire, error: questionnaireError } =
		await memembershipquestionnaireGetMembershipQuestionnaire({
			fetch,
			path: { slug, questionnaire_id: questionnaireId },
			headers: {
				Authorization: `Bearer ${locals.user.accessToken}`
			}
		});

	if (questionnaireError || !questionnaire) {
		log.error('membership_questionnaire_fetch_failed', {
			error: questionnaireError,
			slug,
			questionnaireId
		});
		throw error(404, 'Questionnaire not found');
	}

	return {
		organization: {
			id: organization.id,
			name: organization.name,
			slug: organization.slug
		},
		questionnaire
	};
};
