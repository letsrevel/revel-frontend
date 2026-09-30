import { queryOptions } from '@tanstack/svelte-query';
import {
	organizationGetFollowStatus,
	eventseriesGetFollowStatus
} from '$lib/api/generated/sdk.gen';

export type FollowEntityType = 'organization' | 'event-series';

/**
 * The viewer's follow status for an organization (by slug) or event series (by
 * UUID). Shared by FollowButton and the org page's announcement-mute button so
 * both observe one cached request. The key carries the auth state so it
 * refetches on login.
 */
export function followStatusQueryOptions(
	entityType: FollowEntityType,
	entityId: string,
	accessToken: string | null
) {
	return queryOptions({
		queryKey: ['follow-status', entityType, entityId, !!accessToken],
		queryFn: async () => {
			if (!accessToken) return { is_following: false, follow: null };
			const headers = { Authorization: `Bearer ${accessToken}` };
			const response =
				entityType === 'organization'
					? await organizationGetFollowStatus({ path: { slug: entityId }, headers })
					: await eventseriesGetFollowStatus({ path: { series_id: entityId }, headers });
			// 404 means "not following", which is expected
			if (response.error) return { is_following: false, follow: null };
			return response.data;
		},
		enabled: !!accessToken
	});
}
