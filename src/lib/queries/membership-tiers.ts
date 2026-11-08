import { organizationadminmembersListMembershipTiers } from '$lib/api';
import type { MembershipTierKind, MembershipTierSchema } from '$lib/api/generated/types.gen';
import { standardTiers, temporaryTiers } from '$lib/utils/membership-tier-kind';

/**
 * Query keys for an organization's membership tiers. ONE shape for every
 * consumer: `standard` is `all` plus a suffix, so invalidating `all` (tier
 * create / edit / delete / reorder) also refreshes every standard-only picker.
 * Invariant: only the exact `all` entry holds the unfiltered (all-kinds) list;
 * `setQueryData`/`getQueryData(all)` (TiersTab reorder) must never target `standard` or `temporary`.
 */
export const membershipTiersKeys = {
	all: (slug: string) => ['organization', slug, 'membership-tiers'] as const,
	standard: (slug: string) => ['organization', slug, 'membership-tiers', 'standard'] as const,
	/** TEMPORARY tiers only (the ticket-tier "Grants membership" picker); same prefix rule as `standard`. */
	temporary: (slug: string) => ['organization', slug, 'membership-tiers', 'temporary'] as const
};

/**
 * Fetch the org's tiers of ONE kind. Throws the API error body on failure. The
 * server filters by `kind`; the client-side filter stays as a safety net.
 * Standard is the only kind any picker may offer a backend that takes a tier id;
 * temporary (day-membership) tiers are the only ones a ticket tier may grant.
 */
export async function listTiersOfKind(
	slug: string,
	kind: MembershipTierKind,
	accessToken: string | null | undefined,
	fetchFn?: typeof fetch
): Promise<MembershipTierSchema[]> {
	// Fail clearly instead of sending `Bearer undefined` and surfacing a confusing 401.
	if (!accessToken) throw new Error('listTiersOfKind: missing access token');
	const res = await organizationadminmembersListMembershipTiers({
		...(fetchFn ? { fetch: fetchFn } : {}),
		path: { slug },
		query: { kind },
		headers: { Authorization: `Bearer ${accessToken}` }
	});
	if (res.error) throw res.error;
	return kind === 'standard' ? standardTiers(res.data) : temporaryTiers(res.data);
}

/** TanStack options for a single-kind tiers list; spread into `createQuery`. */
export function tiersOfKindQueryOptions(
	slug: string,
	kind: MembershipTierKind,
	accessToken: string | null | undefined
) {
	return {
		queryKey: membershipTiersKeys[kind](slug),
		queryFn: () => listTiersOfKind(slug, kind, accessToken)
	};
}

/**
 * Fetch the org's tiers of EVERY kind (no `kind` param), for the one consumer that
 * needs both (the ticketing step splits it with `standardTiers`/`temporaryTiers`).
 * Keyed by the exact `all` entry, so tier create/edit/delete invalidation (TiersTab)
 * refreshes it; the data shape matches the Members page query on the same key.
 */
export async function listAllTiers(
	slug: string,
	accessToken: string | null | undefined
): Promise<MembershipTierSchema[]> {
	if (!accessToken) throw new Error('listAllTiers: missing access token');
	const res = await organizationadminmembersListMembershipTiers({
		path: { slug },
		headers: { Authorization: `Bearer ${accessToken}` }
	});
	if (res.error) throw res.error;
	return res.data ?? [];
}

/** TanStack options for the all-kinds tiers list; spread into `createQuery`. */
export function allTiersQueryOptions(slug: string, accessToken: string | null | undefined) {
	return {
		queryKey: membershipTiersKeys.all(slug),
		queryFn: () => listAllTiers(slug, accessToken)
	};
}

/** The org's STANDARD tiers (every picker that sends a tier id to the backend). */
export function listStandardTiers(
	slug: string,
	accessToken: string | null | undefined,
	fetchFn?: typeof fetch
): Promise<MembershipTierSchema[]> {
	return listTiersOfKind(slug, 'standard', accessToken, fetchFn);
}

/** TanStack options for the standard-tiers list; spread into `createQuery`. */
export function standardTiersQueryOptions(slug: string, accessToken: string | null | undefined) {
	return tiersOfKindQueryOptions(slug, 'standard', accessToken);
}
