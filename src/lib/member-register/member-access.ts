import { organizationadminmembersGetMember } from '$lib/api/generated/sdk.gen';
import type { QueryClient } from '@tanstack/svelte-query';
import type { OrganizationMemberSchema } from '$lib/api/generated/types.gen';
import { membersListKey } from '$lib/components/members/user-note';
import { invalidateRegister } from './api';

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

/**
 * Refresh everything a member write can change: the members list, the register
 * (and its duplicates scan), the person sheet's single-member lookup (outside
 * the list prefix, so a note save does not refetch it) and the subscriptions
 * (billing is stopped / moved server-side when membership is lost or moved).
 */
export async function invalidateAfterMemberWrite(
	queryClient: QueryClient,
	slug: string
): Promise<void> {
	await Promise.all([
		queryClient.invalidateQueries({ queryKey: membersListKey(slug) }),
		invalidateRegister(queryClient, slug, true),
		queryClient.invalidateQueries({ queryKey: memberAccessPrefix(slug) }),
		queryClient.invalidateQueries({ queryKey: ['organization', slug, 'subscriptions'] })
	]);
}
