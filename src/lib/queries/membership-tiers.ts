import { organizationadminmembersListMembershipTiers } from '$lib/api';
import type { MembershipTierSchema } from '$lib/api/generated/types.gen';
import { standardTiers } from '$lib/utils/membership-tier-kind';

/**
 * Query keys for an organization's membership tiers. ONE shape for every
 * consumer: `standard` is `all` plus a suffix, so invalidating `all` (tier
 * create / edit / delete / reorder) also refreshes every standard-only picker.
 * Invariant: only the exact `all` entry holds the unfiltered (all-kinds) list;
 * `setQueryData`/`getQueryData(all)` (TiersTab reorder) must never target `standard`.
 */
export const membershipTiersKeys = {
	all: (slug: string) => ['organization', slug, 'membership-tiers'] as const,
	standard: (slug: string) => ['organization', slug, 'membership-tiers', 'standard'] as const
};

/**
 * Fetch the org's STANDARD membership tiers (the only kind any picker may offer
 * a backend that takes a tier id). Throws the API error body on failure. The
 * client-side `standardTiers` filter stays as a safety net.
 */
export async function listStandardTiers(
	slug: string,
	accessToken: string | null | undefined,
	fetchFn?: typeof fetch
): Promise<MembershipTierSchema[]> {
	// Fail clearly instead of sending `Bearer undefined` and surfacing a confusing 401.
	if (!accessToken) throw new Error('listStandardTiers: missing access token');
	const res = await organizationadminmembersListMembershipTiers({
		...(fetchFn ? { fetch: fetchFn } : {}),
		path: { slug },
		query: { kind: 'standard' },
		headers: { Authorization: `Bearer ${accessToken}` }
	});
	if (res.error) throw res.error;
	return standardTiers(res.data);
}

/** TanStack options for the standard-tiers list; spread into `createQuery`. */
export function standardTiersQueryOptions(slug: string, accessToken: string | null | undefined) {
	return {
		queryKey: membershipTiersKeys.standard(slug),
		queryFn: () => listStandardTiers(slug, accessToken)
	};
}
