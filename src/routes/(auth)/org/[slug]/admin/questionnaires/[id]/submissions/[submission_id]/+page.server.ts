import type { PageServerLoad, Actions } from './$types';
import { error, fail, redirect } from '@sveltejs/kit';
import { questionnaireGetSubmissionDetail, questionnaireEvaluateSubmission } from '$lib/api/client';

export const load: PageServerLoad = async ({ params, locals, fetch }) => {
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

	// Fetch submission detail
	const { data: submissionData, error: submissionError } = await questionnaireGetSubmissionDetail({
		fetch,
		path: {
			org_questionnaire_id: id,
			submission_id
		},
		headers
	});

	if (submissionError || !submissionData) {
		console.error('Failed to fetch submission:', submissionError);
		throw error(404, 'Submission not found');
	}

	return {
		submission: submissionData,
		organizationSlug: slug,
		questionnaireId: id
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
			console.error('Failed to submit evaluation:', evaluationError);
			return fail(500, { error: 'Failed to submit evaluation. Please try again.' });
		}

		// Redirect back to submissions list
		throw redirect(303, `/org/${params.slug}/admin/questionnaires/${id}/submissions`);
	}
};
