import { organizationadminmembershiprequestsListMembershipRequests } from '$lib/api/generated/sdk.gen';

/**
 * Pending membership applications, first page. The key and fetcher are the
 * Applications tab's own default view (status `pending`, page 1), so the
 * People tab's "Needs attention" count and the tab share one cache entry and
 * the tab's mutations (which invalidate `membership-requests`) keep it fresh.
 */
export function pendingApplicationsQueryOptions(slug: string, accessToken: string | null) {
	return {
		queryKey: ['organization', slug, 'membership-requests', 'pending', 1] as const,
		queryFn: async () => {
			const response = await organizationadminmembershiprequestsListMembershipRequests({
				path: { slug },
				query: { status: 'pending', page: 1, page_size: 50 },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) {
				throw new Error('Failed to fetch membership requests');
			}
			return response.data;
		},
		enabled: !!accessToken
	};
}
