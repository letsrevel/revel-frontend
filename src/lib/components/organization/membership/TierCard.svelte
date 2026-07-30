<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { resolve } from '$app/paths';
	import { createQuery } from '@tanstack/svelte-query';
	import type {
		MySubscriptionSchema,
		PublicMembershipTierSchema,
		PublicPlanSchema
	} from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { joinEligibilityQueryOptions } from '$lib/queries/join-eligibility';
	import {
		getMembershipStatusMessage,
		isBlockedByMembershipGate
	} from '$lib/utils/membership-eligibility';
	import MarkdownContent from '$lib/components/common/MarkdownContent.svelte';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { ClipboardList, Gift, ShieldCheck } from '@lucide/svelte';
	import MembershipCta from './MembershipCta.svelte';
	import PlanCard from './PlanCard.svelte';

	interface Props {
		tier: PublicMembershipTierSchema;
		organizationSlug: string;
		organizationName: string;
		isAuthenticated: boolean;
		/**
		 * The viewer's live subscription in this org, forwarded untouched to every
		 * PlanCard — see that component for why a non-null value withdraws the
		 * subscribe CTA everywhere.
		 */
		subscription?: MySubscriptionSchema | null;
		subscriptionLoading?: boolean;
		onSubscribe: (plan: PublicPlanSchema & { id: string }) => void;
		/**
		 * Whether to ask the backend what THIS viewer may do with THIS tier.
		 *
		 * False for owners and staff: they already have standing in the org (shown
		 * once at the top of the page), so a verdict per tier would be N pointless
		 * round trips answering a question they never asked.
		 */
		showJoinCta?: boolean;
	}

	const {
		tier,
		organizationSlug,
		organizationName,
		isAuthenticated,
		subscription = null,
		subscriptionLoading = false,
		onSubscribe,
		showJoinCta = true
	}: Props = $props();

	// Unique per instance: several of these cards sit side by side, and each needs
	// its own accessible name.
	const uid = $props.id();
	const headingId = `${uid}-tier-name`;
	/** Referenced by a plan card whose CTA the gates withheld. */
	const requirementsId = `${uid}-tier-requirements`;

	/**
	 * `id` is optional in the generated schema (it is a model field with a
	 * server-side default), but nothing here can act on a tier without one — no
	 * eligibility question to ask, no `tier_id` to post.
	 */
	const tierId = $derived(tier.id ?? null);

	// Cheapest first, and stably: the backend does not promise an order inside a
	// tier, and cards that reshuffle between renders are worse than an arbitrary
	// but fixed order. Same rule the old plan grid used.
	// Block body, not a concise one: `scripts/check-i18n-hardcoded.mjs` scans the
	// whole file for markup text nodes and does not skip script bodies. A concise
	// arrow makes the `>` of `=>` open a match that runs all the way to the script
	// block's closing tag, flagging this code as untranslated prose. The `{` here
	// ends that match immediately. Scanner bug, tracked separately.
	const plans = $derived(
		[...tier.plans].sort((a, b) => {
			return Number(a.price) - Number(b.price);
		})
	);

	/**
	 * Since BE #831 a tier can be gated AND paid, so these are independent
	 * statements about the same tier rather than a single mutually-exclusive
	 * mode. Each badge pairs an icon with its own words — nothing here is carried
	 * by colour (WCAG 1.4.1).
	 */
	const isFree = $derived(tier.is_free);

	const accessToken = $derived(authStore.accessToken);

	/**
	 * Does this tier carry a gate AT ALL? A static fact about the tier, straight
	 * off the public listing — it decides whether to ASK the backend, never
	 * whether to withhold anything. Only a verdict can say that this viewer is
	 * behind the gate; an ungated tier asks nothing and its plan cards behave
	 * exactly as they did before #733.
	 */
	const isGated = $derived.by(() => {
		// Read unconditionally: `||` inside a `$derived` would leave the skipped
		// operand untracked by the query options below.
		const questionnaire = !!tier.questionnaire_id;
		const approval = !!tier.requires_approval;
		return questionnaire || approval;
	});

	/**
	 * The plan the gate verdict is asked about, and why one plan can answer for
	 * all of them.
	 *
	 * A plan is REQUIRED: with no `plan_id` the backend's gate #6 short-circuits
	 * any monetized tier with `tier_requires_subscription` and never reaches the
	 * questionnaire and approval gates at all — which is exactly why the CTA's
	 * own tier-only verdict cannot answer this question. Given a plan, the gates
	 * that do run above the payment one are facts about the (viewer, tier) pair,
	 * identical for every plan on the card; `isBlockedByMembershipGate` keeps only
	 * those, so the choice of plan below cannot leak into the answer.
	 *
	 * Cheapest first (the list is already sorted) among the plans that could
	 * offer a CTA at all: an offline, sold-out or paused plan card shows no
	 * Subscribe for the gate to withdraw, so a tier with nothing else on it asks
	 * nothing.
	 */
	const gatePlanId = $derived(
		plans.find(
			(p) => !!p.id && p.payment_method !== 'offline' && !p.sold_out && p.sales_status !== 'paused'
		)?.id ?? null
	);

	const gateQueryEnabled = $derived.by(() => {
		// Every operand read unconditionally, for the reason given above.
		const authed = isAuthenticated;
		const gated = isGated;
		const hasTier = !!tierId;
		const hasPlan = !!gatePlanId;
		const token = !!accessToken;
		// Owners and staff pass the gate stack by definition (gate #1), and the
		// grid already suppresses their per-tier CTA; asking would be N round
		// trips for a question they never posed.
		const asks = showJoinCta;
		// A viewer with a live subscription gets the member branch on every card,
		// so no verdict could change what they see.
		const subscribed = !!subscription;
		return authed && gated && hasTier && hasPlan && token && asks && !subscribed;
	});

	const gateQuery = createQuery(() =>
		joinEligibilityQueryOptions({
			organizationSlug,
			tierId,
			planId: gatePlanId,
			accessToken,
			enabled: gateQueryEnabled
		})
	);

	const gateVerdict = $derived(gateQuery.data ?? null);
	const gateBlocked = $derived(gateVerdict ? isBlockedByMembershipGate(gateVerdict) : false);
	const gateReason = $derived(
		gateBlocked && gateVerdict ? getMembershipStatusMessage(gateVerdict) : null
	);
	// `isLoading`, not `isPending`: a disabled query stays pending forever, and
	// that would hold the Subscribe button of every ungated tier hostage.
	const gatePending = $derived(gateQuery.isLoading);
</script>

<!-- `<article>` + `aria-labelledby`, not a labelled `region`: the cards are peers
     in a list and each must announce which tier it is, but N landmarks on one
     page would drown the page's real ones. -->
<article class="h-full" aria-labelledby={headingId}>
	<Card class="flex h-full flex-col">
		<CardContent class="flex flex-1 flex-col gap-4 p-4 sm:p-5">
			<div class="space-y-2">
				<div class="flex flex-wrap items-start justify-between gap-2">
					<h3 id={headingId} class="text-lg font-semibold">{tier.name}</h3>
					{#if isFree}
						<span
							class="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
						>
							<Gift class="h-3 w-3" aria-hidden="true" />
							{m['membershipTiers.freeBadge']()}
						</span>
					{/if}
				</div>

				{#if tier.description}
					<MarkdownContent content={tier.description} class="text-sm text-muted-foreground" />
				{/if}
			</div>

			<!-- What it takes to get in. Rendered for everyone, member or not: it is a
		     description of the tier, not of the viewer's progress through it. -->
			{#if tier.requires_approval || tier.questionnaire_id}
				<ul id={requirementsId} class="space-y-1.5 text-sm">
					{#if tier.requires_approval}
						<li class="flex items-start gap-2">
							<ShieldCheck
								class="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
								aria-hidden="true"
							/>
							<span>{m['membershipTiers.requiresApproval']()}</span>
						</li>
					{/if}
					{#if tier.questionnaire_id}
						<li class="flex items-start gap-2">
							<ClipboardList
								class="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
								aria-hidden="true"
							/>
							<span>
								{m['membershipTiers.questionnaireRequired']()}
								{#if tier.questionnaire_id}
									<!-- Named with the tier: a screen-reader user tabbing the page
								     would otherwise hear the same link text on every card. -->
									<a
										href={resolve('/(public)/org/[slug]/questionnaire/[id]', {
											slug: organizationSlug,
											id: tier.questionnaire_id
										})}
										aria-label={m['membershipTiers.questionnaireLinkAria']({ tier: tier.name })}
										class="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
									>
										{m['membershipTiers.questionnaireLink']()}
									</a>
								{/if}
							</span>
						</li>
					{/if}
				</ul>
			{/if}

			{#if plans.length > 0}
				<div class="space-y-3">
					{#each plans as plan (plan.id ?? `${tier.id}-${plan.name}`)}
						<PlanCard
							{plan}
							{isAuthenticated}
							{subscription}
							{subscriptionLoading}
							{organizationSlug}
							{onSubscribe}
							{gateBlocked}
							{gateReason}
							{gatePending}
							gateRequirementsId={requirementsId}
						/>
					{/each}
				</div>
			{/if}

			<div class="mt-auto pt-1">
				{#if showJoinCta && tierId}
					<MembershipCta
						{organizationSlug}
						{organizationName}
						{isAuthenticated}
						{tierId}
						tierName={tier.name}
						plansInline={plans.length > 0}
					/>
				{/if}
			</div>
		</CardContent>
	</Card>
</article>
