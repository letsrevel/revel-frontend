/**
 * Cache plumbing for member-facing subscription mutations (#693).
 *
 * Cancel and change-plan both answer with the full, updated `MySubscriptionSchema`
 * — the same shape the three member-facing subscription queries serve. That
 * response body is the only snapshot guaranteed to describe what the member just
 * asked for, so it is what the caches are seeded with.
 *
 * Why a plain `invalidateQueries` is not enough: the backend mirrors the change
 * to Stripe, and Stripe's follow-up webhooks land *after* the 200. For a member
 * who cancels at period end while a downgrade schedule exists, the
 * schedule-release webhook writes `cancel_at_period_end: false` back onto the row
 * ~40ms later. A refetch that lands inside that window returns a row that
 * contradicts the response the member just got, and — with nothing re-polling —
 * the account-hub card reads "Next renewal" instead of "Cancels on …" until a
 * reload. The upstream fix belongs in the backend's schedule-release sync
 * (letsrevel/revel-frontend#693); this module makes the frontend stop showing the
 * transient lie.
 */
import type { QueryClient } from '@tanstack/svelte-query';
import type { MyMembershipSchema, MySubscriptionSchema } from '$lib/api/generated/types.gen';

/** Account hub: the member's live memberships, each with its subscription inlined. */
export const MY_MEMBERSHIPS_KEY = ['me', 'memberships'] as const;

/** Account hub: every subscription the member has ever had, including expired ones. */
export const MY_SUBSCRIPTIONS_KEY = ['me', 'subscriptions'] as const;

/**
 * Org page: the member's current subscription in one org (`null` when there is
 * none). Also the prefix of the checkout-return caches, which is why it is only
 * ever passed to `invalidateQueries` (prefix match) and `setQueryData` (exact
 * match) — never to anything that would confuse the two.
 */
export function myOrgSubscriptionKey(orgId: string): readonly [string, string, string, string] {
	return ['me', 'org', orgId, 'subscription'] as const;
}

/**
 * Same *live* subscription? The memberships list and the per-org query hold at
 * most one non-terminal subscription per organization, so the org is the key
 * there; `id` is preferred whenever both sides carry one.
 */
function isSameLiveSubscription(
	cached: MySubscriptionSchema,
	fresh: MySubscriptionSchema
): boolean {
	if (cached.id && fresh.id) return cached.id === fresh.id;
	return cached.organization_id === fresh.organization_id;
}

/**
 * Write `fresh` into every member-facing cache that already holds the same
 * subscription.
 *
 * Contract: **patch in place, never insert, never remove.** An absent cache stays
 * absent (a `setQueryData` updater returning `undefined` is a no-op), and a row
 * the backend has already stopped inlining — an immediate cancel makes the
 * subscription terminal, which drops it from the memberships list and 404s the
 * per-org endpoint — is not resurrected. That is what makes this safe to run
 * again *after* a refetch: it can only ever restate the field values of a row the
 * server itself still lists.
 */
export function seedSubscriptionCaches(
	queryClient: QueryClient,
	fresh: MySubscriptionSchema
): void {
	queryClient.setQueryData<MyMembershipSchema[]>(MY_MEMBERSHIPS_KEY, (rows) =>
		rows?.map((row) =>
			row.subscription && isSameLiveSubscription(row.subscription, fresh)
				? { ...row, subscription: fresh }
				: row
		)
	);

	// Keyed strictly on `id`: this list is per-subscription history, so one org can
	// appear several times and matching on the org would rewrite a member's expired
	// row (the one a rejoin offer is built from).
	queryClient.setQueryData<MySubscriptionSchema[]>(MY_SUBSCRIPTIONS_KEY, (rows) =>
		rows?.map((row) => (fresh.id && row.id === fresh.id ? fresh : row))
	);

	queryClient.setQueryData<MySubscriptionSchema | null>(
		myOrgSubscriptionKey(fresh.organization_id),
		(cached) => (cached && isSameLiveSubscription(cached, fresh) ? fresh : cached)
	);
}

/**
 * Seed → refetch → seed again, so the mutation's own response body is the last
 * writer whatever the refetch returns.
 *
 * The first seed makes the member's choice visible immediately (no network round
 * trip). The invalidation still runs, because the response only speaks for *this*
 * subscription while the same endpoints also carry membership status and sibling
 * rows that the mutation may have changed. The second seed then re-asserts the
 * response on top of whatever came back — which is the whole point: a refetch that
 * raced Stripe's write-back would otherwise be the last writer and would contradict
 * the 200 the member just received.
 *
 * The re-assert only restates fields of rows the refetch itself returned (see
 * `seedSubscriptionCaches`), and it is bounded to this one mutation — any later
 * refetch, remount or reload shows plain server state again, by which time the
 * backend has converged.
 *
 * Never rejects: a failed refetch leaves the seeded truth standing, which is the
 * outcome we want anyway, so callers can fire it and forget it.
 */
export async function settleSubscriptionCaches(
	queryClient: QueryClient,
	fresh: MySubscriptionSchema
): Promise<void> {
	seedSubscriptionCaches(queryClient, fresh);
	try {
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: MY_MEMBERSHIPS_KEY }),
			queryClient.invalidateQueries({ queryKey: MY_SUBSCRIPTIONS_KEY }),
			// Prefix match on purpose: it also clears the checkout-return caches
			// nested under this key.
			queryClient.invalidateQueries({ queryKey: myOrgSubscriptionKey(fresh.organization_id) })
		]);
	} catch {
		// Refetch failures are already reflected in each query's own error state.
	}
	seedSubscriptionCaches(queryClient, fresh);
}
