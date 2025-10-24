import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { questionnaireListSubmissions } from '$lib/api/client';

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
	const statusFilter = url.searchParams.get('status') || undefined;
	const evaluationStatusFilter = url.searchParams.get('evaluation_status') || undefined;
	const ordering = url.searchParams.get('ordering') || '-submitted_at';

	// Fetch submissions
	const { data: submissionsData, error: submissionsError } = await questionnaireListSubmissions({
		fetch,
		path: {
			org_questionnaire_id: id
		},
		query: {
			page,
			page_size: pageSize,
			search,
			status: statusFilter as any,
			evaluation_status: evaluationStatusFilter as any,
			ordering
		},
		headers
	});

	if (submissionsError || !submissionsData) {
		console.error('Failed to fetch submissions:', submissionsError);
		throw error(500, 'Failed to load submissions');
	}

	// Calculate stats from the response
	const stats = {
		pendingCount: submissionsData.results.filter((s) => s.evaluation_status === 'pending review')
			.length,
		approvedCount: submissionsData.results.filter((s) => s.evaluation_status === 'approved').length,
		rejectedCount: submissionsData.results.filter((s) => s.evaluation_status === 'rejected').length
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
			status: statusFilter,
			evaluationStatus: evaluationStatusFilter,
			ordering
		},
		organizationSlug: slug,
		questionnaireId: id
	};
};
