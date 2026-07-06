import { error } from '@sveltejs/kit';
import {
	questionnaireGetOrgQuestionnaire,
	questionnaireGetSummary
} from '$lib/api/generated/sdk.gen';
import { extractErrorMessage } from '$lib/utils/errors';
import { log } from '$lib/server/logger';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const user = locals.user;

	if (!user) {
		throw error(401, 'Unauthorized');
	}

	const headers = { Authorization: `Bearer ${user.accessToken}` };
	const { slug, id } = params;

	// Get optional filter params
	const eventId = url.searchParams.get('event_id') || undefined;
	const eventSeriesId = url.searchParams.get('event_series_id') || undefined;

	try {
		// Fetch questionnaire detail and summary in parallel
		const [questionnaireRes, summaryRes] = await Promise.all([
			questionnaireGetOrgQuestionnaire({
				path: { org_questionnaire_id: id },
				headers
			}),
			questionnaireGetSummary({
				path: { org_questionnaire_id: id },
				query: {
					event_id: eventId,
					event_series_id: eventSeriesId
				},
				headers
			})
		]);

		if (questionnaireRes.error) {
			const msg = extractErrorMessage(questionnaireRes.error, 'Questionnaire not found');
			throw error(404, msg);
		}

		if (summaryRes.error || !summaryRes.data) {
			const msg = extractErrorMessage(summaryRes.error, 'Failed to load summary');
			throw error(500, msg);
		}

		if (!questionnaireRes.data) {
			throw error(404, 'Questionnaire not found');
		}

		return {
			questionnaire: questionnaireRes.data,
			summary: summaryRes.data,
			organizationSlug: slug,
			questionnaireId: id,
			filters: {
				eventId: eventId || null,
				eventSeriesId: eventSeriesId || null
			}
		};
	} catch (err) {
		// Re-throw SvelteKit errors
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		log.error('questionnaire_summary_load_failed', { id, error: err });
		const msg = extractErrorMessage(err, 'Failed to load summary');
		throw error(500, msg);
	}
};
