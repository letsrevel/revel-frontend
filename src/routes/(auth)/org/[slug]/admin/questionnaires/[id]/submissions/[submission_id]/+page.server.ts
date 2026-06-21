import type { PageServerLoad, Actions } from './$types';
import { error, fail, redirect } from '@sveltejs/kit';
import {
	questionnaireGetSubmissionDetail,
	questionnaireEvaluateSubmission,
	questionnaireGetOrgQuestionnaire,
	questionnaireListSubmissions
} from '$lib/api/client';
import { log } from '$lib/server/logger';

// How many siblings to load for Next/Previous navigation. Covers the vast
// majority of questionnaires; submissions beyond this window simply don't get
// neighbor links (the buttons disable at the edges of the loaded set).
const SIBLING_NAV_LIMIT = 100;

export const load: PageServerLoad = async ({ params, url, locals, fetch }) => {
	const { slug, id, submission_id } = params;

	// Ensure user is authenticated
	const user = locals.user;
	if (!user) {
		throw error(401, 'Unauthorized');
	}

	// Prepare headers with authentication
	const headers: HeadersInit = {
		Authorization: `Bearer ${user.accessToken}`
	};

	// Carry the list's filter/sort context so Next/Previous walks the same
	// ordered, filtered set the reviewer was looking at.
	const search = url.searchParams.get('search') || undefined;
	const evaluationStatus = url.searchParams.get('evaluation_status') || undefined;
	const orderBy = (url.searchParams.get('order_by') || '-submitted_at') as
		| 'submitted_at'
		| '-submitted_at';

	// Fetch submission detail, org questionnaire, and the sibling list in parallel
	const [submissionResult, questionnaireResult, siblingsResult] = await Promise.all([
		questionnaireGetSubmissionDetail({
			fetch,
			path: { org_questionnaire_id: id, submission_id },
			headers
		}),
		questionnaireGetOrgQuestionnaire({
			fetch,
			path: { org_questionnaire_id: id },
			headers
		}),
		questionnaireListSubmissions({
			fetch,
			path: { org_questionnaire_id: id },
			query: {
				page: 1,
				page_size: SIBLING_NAV_LIMIT,
				search,
				evaluation_status: evaluationStatus,
				order_by: orderBy
			},
			headers
		})
	]);

	if (submissionResult.error || !submissionResult.data) {
		log.error('submission_detail_load_failed', {
			id,
			submission_id,
			error: submissionResult.error
		});
		throw error(404, 'Submission not found');
	}

	// Compute Previous/Next neighbors within the loaded, filtered, ordered set.
	const siblings = siblingsResult.data?.results ?? [];
	const totalSiblings = siblingsResult.data?.count ?? siblings.length;
	const currentIndex = siblings.findIndex((s) => s.id === submission_id);
	const previousId = currentIndex > 0 ? siblings[currentIndex - 1].id : null;
	const nextId =
		currentIndex >= 0 && currentIndex < siblings.length - 1 ? siblings[currentIndex + 1].id : null;

	// Preserve the filter/sort query string on neighbor and back links.
	const contextQuery = url.searchParams.toString();

	return {
		submission: submissionResult.data,
		organizationSlug: slug,
		questionnaireId: id,
		requiresEvaluation: questionnaireResult.data?.requires_evaluation ?? true,
		navigation: {
			previousId,
			nextId,
			// 1-based position; null when the submission falls outside the loaded window
			position: currentIndex >= 0 ? currentIndex + 1 : null,
			total: totalSiblings,
			contextQuery
		}
	};
};

export const actions: Actions = {
	evaluate: async ({ request, params, locals, fetch }) => {
		const { id, submission_id } = params;

		// Ensure user is authenticated
		const user = locals.user;
		if (!user) {
			return fail(401, { error: 'Unauthorized' });
		}

		// Prepare headers with authentication
		const headers: HeadersInit = {
			Authorization: `Bearer ${user.accessToken}`
		};

		const formData = await request.formData();
		const status = formData.get('status') as string;
		const score = formData.get('score') as string | null;
		const comments = formData.get('comments') as string | null;

		// Validate status
		if (!status || !['approved', 'rejected', 'pending review'].includes(status)) {
			return fail(400, { error: 'Invalid evaluation status' });
		}

		// Build evaluation payload
		const evaluationData: {
			status: 'approved' | 'rejected' | 'pending review';
			score?: number;
			comments?: string;
		} = {
			status: status as 'approved' | 'rejected' | 'pending review'
		};

		if (score) {
			const scoreNum = parseFloat(score);
			if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > 100) {
				return fail(400, { error: 'Score must be between 0 and 100' });
			}
			evaluationData.score = scoreNum;
		}

		if (comments && comments.trim().length > 0) {
			evaluationData.comments = comments.trim();
		}

		// Submit evaluation
		const { data: result, error: evaluationError } = await questionnaireEvaluateSubmission({
			fetch,
			path: {
				org_questionnaire_id: id,
				submission_id
			},
			body: evaluationData as any,
			headers
		});

		if (evaluationError || !result) {
			log.error('submission_evaluation_failed', { id, submission_id, error: evaluationError });
			return fail(500, { error: 'Failed to submit evaluation. Please try again.' });
		}

		// Redirect back to submissions list
		throw redirect(303, `/org/${params.slug}/admin/questionnaires/${id}/submissions`);
	}
};
