import { organizationadminmembersGetMember } from '$lib/api/generated/sdk.gen';
import type { OrganizationMemberSchema } from '$lib/api/generated/types.gen';

/**
 * Key of one person's access row. Deliberately OUTSIDE the
 * `['organization', slug, 'members']` list prefix: a staff-note save (or any
 * list refetch) must not refetch it. Member mutations invalidate it explicitly.
 */
export const memberAccessKey = (slug: string, userId: string) =>
	['organization', slug, 'member', userId] as const;

/** Prefix that matches every person's access row of one organization. */
export const memberAccessPrefix = (slug: string) => ['organization', slug, 'member'] as const;

/**
 * One person's access row in ANY status (active, paused, cancelled, banned).
 * Resolves to null on a 404 (no access row at all); every other failure throws
 * so TanStack Query retries and surfaces the error.
 */
export async function fetchMemberAccess(
	slug: string,
	accessToken: string | null | undefined,
	userId: string
): Promise<OrganizationMemberSchema | null> {
	if (!accessToken) throw new Error('member-access: missing access token');
	const res = await organizationadminmembersGetMember({
		path: { slug, user_id: userId },
		headers: { Authorization: `Bearer ${accessToken}` }
	});
	if (res.response?.status === 404) return null;
	if (res.error) throw new Error('Failed to fetch member');
	return res.data ?? null;
}
