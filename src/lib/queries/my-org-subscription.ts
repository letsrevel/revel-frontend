import { queryOptions } from '@tanstack/svelte-query';
import { mesubscriptionsGetMySubscription } from '$lib/api/generated/sdk.gen';
import type { MySubscriptionSchema } from '$lib/api/generated/types.gen';
import { myOrgSubscriptionKey } from '$lib/utils/subscription-cache';

/**
 * The viewer's *live* subscription in one organization (`null` when there is none).
 *
 * The backend endpoint already excludes `TERMINAL_STATUSES`
 * (`MeSubscriptionsController.get_my_subscription`), so a non-null result is
 * exactly the condition under which `POST …/subscribe` can only answer
 * `400 "This user already has an active subscription in this organization."`
 * — the same set the create path refuses (`subscription_service`). The presence
 * of a row is therefore the whole predicate; the frontend must not hand-roll a
 * status list to re-derive it, and a cancelled/expired member simply gets no
 * row and can subscribe again.
 *
 * Shared so every surface on the org page — the membership card and the plan
 * grid — observes the *same* key and fetcher. TanStack de-duplicates them into
 * a single request, and the checkout-return card's invalidation of
 * `myOrgSubscriptionKey` refreshes both at once.
 */
export function myOrgSubscriptionQueryOptions(orgId: string, accessToken: string | null) {
	return queryOptions({
		queryKey: myOrgSubscriptionKey(orgId),
		queryFn: async (): Promise<MySubscriptionSchema | null> => {
			const res = await mesubscriptionsGetMySubscription({
				path: { org_id: orgId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			// A 404 means "never subscribed, or only terminal history" — a normal
			// answer for most visitors, not an error state.
			if (res.error) return null;
			return res.data as MySubscriptionSchema;
		},
		enabled: !!accessToken,
		retry: false
	});
}
