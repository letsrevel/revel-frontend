<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { resolve } from '$app/paths';
	import type {
		MySubscriptionSchema,
		PublicMembershipTierSchema,
		PublicPlanSchema
	} from '$lib/api/generated/types.gen';
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
				<ul class="space-y-1.5 text-sm">
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
