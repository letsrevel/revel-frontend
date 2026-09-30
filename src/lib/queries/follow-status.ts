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
			if (response.error) {
				// 404 means "not following", which is expected. Anything else is a
				// real failure: throw, so consumers (the announcement-mute button
				// hides for followers) don't mistake an outage for "not following".
				if (response.response?.status === 404) return { is_following: false, follow: null };
				throw response.error;
			}
			return response.data;
		},
		enabled: !!accessToken
	});
}
