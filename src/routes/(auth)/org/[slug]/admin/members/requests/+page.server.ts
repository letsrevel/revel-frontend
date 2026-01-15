import { error, fail, redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	organizationadminmembershiprequestsListMembershipRequests,
	organizationadminmembershiprequestsApproveMembershipRequest,
	organizationadminmembershiprequestsRejectMembershipRequest
} from '$lib/api/generated/sdk.gen';
import { extractErrorMessage } from '$lib/utils/errors';

/**
 * Load membership requests for this organization
 */
export const load: PageServerLoad = async ({ parent, params, url, cookies }) => {
	const { organization } = await parent();
	const accessToken = cookies.get('access_token');

	if (!organization) {
		throw error(404, 'Organization not found');
	}

	if (!accessToken) {
		throw redirect(302, `/login?redirect=${encodeURIComponent(url.pathname)}`);
	}

	// Get pagination params
	const page = parseInt(url.searchParams.get('page') || '1', 10);
	const pageSize = parseInt(url.searchParams.get('page_size') || '20', 10);
	// Get status filter (pending, approved, rejected)
	const status = url.searchParams.get('status') || undefined;

	try {
		const response = await organizationadminmembershiprequestsListMembershipRequests({
			path: { slug: params.slug },
			query: {
				page,
				page_size: pageSize,
				status: status ? (status as any) : undefined
			},
			headers: {
				Authorization: `Bearer ${accessToken}`
			}
		});

		if (response.error) {
			console.error('Failed to fetch membership requests:', response.error);
			throw error(500, 'Failed to load membership requests');
		}

		const membershipRequests = response.data?.results || [];
		const totalCount = response.data?.count || 0;
		const totalPages = Math.ceil(totalCount / pageSize);

		return {
			organization,
			membershipRequests,
			pagination: {
				page,
				pageSize,
				totalCount,
				totalPages,
				hasNext: page < totalPages,
				hasPrev: page > 1
			},
			filters: {
				status
			}
		};
	} catch (err) {
		console.error('Error loading membership requests:', err);
		throw error(500, 'Failed to load membership requests');
	}
};

/**
 * Form actions for approve/reject
 */
export const actions: Actions = {
	approve: async ({ request, params, cookies }) => {
		const accessToken = cookies.get('access_token');

		if (!accessToken) {
			return fail(401, {
				errors: {
					form: 'You must be logged in to approve requests'
				}
			});
		}

		const formData = await request.formData();
		const requestId = formData.get('request_id') as string;
		const tierId = formData.get('tier_id') as string;

		if (!requestId) {
			return fail(400, {
				errors: {
					form: 'Request ID is required'
				}
			});
		}

		if (!tierId) {
			return fail(400, {
				errors: {
					form: 'Tier ID is required'
				}
			});
		}

		try {
			const response = await organizationadminmembershiprequestsApproveMembershipRequest({
				path: {
					slug: params.slug,
					request_id: requestId
				},
				body: {
					tier_id: tierId
				},
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (response.error) {
				const errorMessage = extractErrorMessage(response.error, 'Failed to approve request');
				return fail(500, {
					errors: {
						form: errorMessage
					}
				});
			}

			return {
				success: true,
				action: 'approved'
			};
		} catch (err) {
			console.error('Error approving membership request:', err);
			const errorMessage = extractErrorMessage(
				err,
				'An unexpected error occurred while approving the request'
			);
			return fail(500, {
				errors: {
					form: errorMessage
				}
			});
		}
	},

	reject: async ({ request, params, cookies }) => {
		const accessToken = cookies.get('access_token');

		if (!accessToken) {
			return fail(401, {
				errors: {
					form: 'You must be logged in to reject requests'
				}
			});
		}

		const formData = await request.formData();
		const requestId = formData.get('request_id') as string;

		if (!requestId) {
			return fail(400, {
				errors: {
					form: 'Request ID is required'
				}
			});
		}

		try {
			const response = await organizationadminmembershiprequestsRejectMembershipRequest({
				path: {
					slug: params.slug,
					request_id: requestId
				},
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (response.error) {
				const errorMessage = extractErrorMessage(response.error, 'Failed to reject request');
				return fail(500, {
					errors: {
						form: errorMessage
					}
				});
			}

			return {
				success: true,
				action: 'rejected'
			};
		} catch (err) {
			console.error('Error rejecting membership request:', err);
			const errorMessage = extractErrorMessage(
				err,
				'An unexpected error occurred while rejecting the request'
			);
			return fail(500, {
				errors: {
					form: errorMessage
				}
			});
		}
	}
};
