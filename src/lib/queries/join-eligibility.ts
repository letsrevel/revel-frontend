import { queryOptions } from '@tanstack/svelte-query';
import { memembershipapplicationsGetJoinEligibility } from '$lib/api/generated/sdk.gen';
import type {
	JoinEligibilityQuery,
	MembershipEligibilitySchema
} from '$lib/api/generated/types.gen';

interface JoinEligibilityArgs {
	organizationSlug: string;
	/** The tier the question is about; `null` asks about the org as a whole. */
	tierId: string | null;
	/**
	 * Narrows the question to one plan, which is the ONLY way to reach the
	 * payment half of the backend's gate stack: with no plan, gate #6
	 * (`TierAvailabilityGate`) short-circuits any monetized tier with
	 * `tier_requires_subscription` and the questionnaire/approval gates below it
	 * never run. A verdict about a paid tier's gates therefore has to name a plan.
	 */
	planId?: string | null;
	accessToken: string | null;
	enabled: boolean;
}

/**
 * `['org', slug, 'join-eligibility', tierId]`, plus the plan when there is one.
 *
 * The plan is appended rather than always present so the tier-only key keeps its
 * existing four-element shape. Every invalidation in the app targets the
 * three-element prefix (`ApplyDialog`, `SubscribeDialog`, `CheckoutReturnCard`,
 * the questionnaire page), and TanStack matches keys by prefix, so both shapes
 * are refreshed by all of them.
 */
export function joinEligibilityKey(
	organizationSlug: string,
	tierId: string | null,
	planId: string | null = null
): (string | null)[] {
	const base = ['org', organizationSlug, 'join-eligibility', tierId ?? null];
	return planId ? [...base, planId] : base;
}

/**
 * What THIS viewer may do with THIS tier (optionally: with this plan).
 *
 * Shared so the tier CTA and the tier's plan cards observe the same key and
 * fetcher — TanStack de-duplicates identical keys into one request, and one
 * prefix invalidation refreshes every card on the page.
 *
 * `retry: false` is deliberate and inherited from the CTA's original inline
 * query: a refused verdict is a decision, not a blip, and silent retries would
 * hammer the endpoint once per tier on every org page.
 */
export function joinEligibilityQueryOptions({
	organizationSlug,
	tierId,
	planId = null,
	accessToken,
	enabled
}: JoinEligibilityArgs) {
	return queryOptions({
		queryKey: joinEligibilityKey(organizationSlug, tierId, planId),
		queryFn: async (): Promise<MembershipEligibilitySchema> => {
			// Only the parameters that have a value: the backend treats an absent
			// `tier_id` as "the org as a whole", and a literal `tier_id=` would be a
			// different question.
			const query: JoinEligibilityQuery = {};
			if (tierId) query.tier_id = tierId;
			if (planId) query.plan_id = planId;
			const res = await memembershipapplicationsGetJoinEligibility({
				path: { slug: organizationSlug },
				query: tierId || planId ? query : undefined,
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			// hey-api resolves rather than throws — a missing payload is a failure
			// even when no error body came back.
			if (res.error || !res.data) {
				throw new Error('Failed to load membership eligibility');
			}
			return res.data;
		},
		enabled,
		retry: false
	});
}
