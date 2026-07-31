/**
 * The organization's questionnaires, as the *client* caches them (#722).
 *
 * One surface reads this through TanStack: the members admin, whose tier form
 * offers every `questionnaire_type === 'membership'` questionnaire as the tier's
 * membership-questionnaire override. Everything else — the questionnaire admin
 * list, the org settings default picker — is `+page.server.ts`-loaded and
 * therefore re-reads the server on every navigation.
 *
 * That split is the whole bug: creating a questionnaire mutates the server list
 * while the cached copy behind this key keeps answering for `staleTime`
 * (60 s, set globally in `src/routes/+layout.svelte`), so a brand-new membership
 * questionnaire was missing from the picker until a hard refresh.
 *
 * The rule this module exists to enforce: **every mutation of an org
 * questionnaire — create, update (a `questionnaire_type` change moves a row into
 * or out of the picker), delete, duplicate — calls
 * `invalidateOrgQuestionnaires`.** The key is never written inline again;
 * `orgQuestionnairesQueryOptions` and `invalidateOrgQuestionnaires` are the only
 * two places that know it, so a reader and an invalidator cannot drift apart.
 *
 * Mutations that also change server-loaded data pair this with `invalidateAll()`
 * — the two caches are independent and neither refreshes the other.
 */
import { queryOptions, type QueryClient } from '@tanstack/svelte-query';
import { questionnaireListOrgQuestionnaires } from '$lib/api/generated/sdk.gen';

/**
 * Cache key for one organization's questionnaire list.
 *
 * Keyed by slug — not id — because that is what every other query on the members
 * admin is keyed by, so the whole page's cache stays inspectable under one
 * `['organization', slug]` prefix.
 */
export function orgQuestionnairesKey(
	organizationSlug: string
): readonly ['organization', string, 'membership-questionnaires'] {
	return ['organization', organizationSlug, 'membership-questionnaires'] as const;
}

interface OrgQuestionnairesQueryArgs {
	organizationId: string;
	organizationSlug: string;
	accessToken: string | null;
	enabled?: boolean;
}

/**
 * The list itself. The endpoint has no `questionnaire_type` filter, so callers
 * narrow client-side — which is also why a *retyped* questionnaire has to
 * invalidate: the row is already cached, just under the wrong type.
 */
export function orgQuestionnairesQueryOptions({
	organizationId,
	organizationSlug,
	accessToken,
	enabled = true
}: OrgQuestionnairesQueryArgs) {
	return queryOptions({
		queryKey: orgQuestionnairesKey(organizationSlug),
		queryFn: async () => {
			const response = await questionnaireListOrgQuestionnaires({
				query: { organization_id: organizationId, page_size: 100 },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to fetch questionnaires');
			}

			return response.data;
		},
		enabled: !!accessToken && enabled
	});
}

/**
 * Drop the cached list for one organization after mutating its questionnaires.
 *
 * Safe to call from a handler that is about to `goto(...)`: with no mounted
 * observer this only marks the entry stale (no request, resolves immediately),
 * and the members admin refetches the next time it mounts the query. Await it
 * before navigating anyway, so the marking cannot be lost to an unmount.
 */
export function invalidateOrgQuestionnaires(
	queryClient: QueryClient,
	organizationSlug: string
): Promise<void> {
	return queryClient.invalidateQueries({ queryKey: orgQuestionnairesKey(organizationSlug) });
}
