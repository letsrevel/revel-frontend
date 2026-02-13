import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { questionnaireListSubmissions, questionnaireGetSummary } from '$lib/api/client';

export const load: PageServerLoad = async ({ params, url, locals, fetch }) => {
	const { slug, id } = params;

	// Ensure user is authenticated
	const user = locals.user;
	if (!user) {
		throw error(401, 'Unauthorized');
	}

	// Prepare headers with authentication
	const headers: HeadersInit = {
		Authorization: `Bearer ${user.accessToken}`
	};

	// Get query parameters for filtering and pagination
	const page = parseInt(url.searchParams.get('page') || '1');
	const pageSize = parseInt(url.searchParams.get('page_size') || '20');
	const search = url.searchParams.get('search') || undefined;
	const evaluationStatusFilter = url.searchParams.get('evaluation_status') || undefined;
	const orderBy = (url.searchParams.get('order_by') || '-submitted_at') as
		| 'submitted_at'
		| '-submitted_at';

	// Fetch submissions and summary in parallel
	const [submissionsResult, summaryResult] = await Promise.all([
		questionnaireListSubmissions({
			fetch,
			path: {
				org_questionnaire_id: id
			},
			query: {
				page,
				page_size: pageSize,
				search,
				evaluation_status: evaluationStatusFilter,
				order_by: orderBy
			},
			headers
		}),
		questionnaireGetSummary({
			fetch,
			path: {
				org_questionnaire_id: id
			},
			headers
		})
	]);

	if (submissionsResult.error || !submissionsResult.data) {
		console.error('Failed to fetch submissions:', submissionsResult.error);
		throw error(500, 'Failed to load submissions');
	}

	const submissionsData = submissionsResult.data;

	// Use summary data for accurate stats across all submissions
	const stats = summaryResult.data
		? {
				pendingCount:
					(summaryResult.data.by_status_per_user.pending_review ?? 0) +
					(summaryResult.data.by_status_per_user.not_evaluated ?? 0),
				approvedCount: summaryResult.data.by_status_per_user.approved ?? 0,
				rejectedCount: summaryResult.data.by_status_per_user.rejected ?? 0
			}
		: {
				pendingCount: 0,
				approvedCount: 0,
				rejectedCount: 0
			};

	return {
		submissions: submissionsData.results,
		pagination: {
			count: submissionsData.count,
			next: submissionsData.next,
			previous: submissionsData.previous,
			currentPage: page,
			pageSize,
			totalPages: Math.ceil(submissionsData.count / pageSize)
		},
		stats,
		filters: {
			search,
			evaluationStatus: evaluationStatusFilter,
			orderBy
		},
		organizationSlug: slug,
		questionnaireId: id
	};
};
