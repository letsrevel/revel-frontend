<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { resolve } from '$app/paths';
	import { createQuery } from '@tanstack/svelte-query';
	import type {
		ContactMethod,
		MySubscriptionSchema,
		PublicMembershipTierSchema,
		PublicPlanSchema
	} from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { joinEligibilityQueryOptions } from '$lib/queries/join-eligibility';
	import {
		getMembershipGateAction,
		getMembershipRequirementState,
		getMembershipStatusMessage
	} from '$lib/utils/membership-eligibility';
	import MarkdownContent from '$lib/components/common/MarkdownContent.svelte';
	import PricingCard from '$lib/components/common/PricingCard.svelte';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';
	import { ClipboardList, Gift, ShieldCheck } from '@lucide/svelte';
	import ApplyDialog from './ApplyDialog.svelte';
	import MembershipCta from './MembershipCta.svelte';
	import PlanCard from './PlanCard.svelte';

	interface Props {
		tier: PublicMembershipTierSchema;
		organizationSlug: string;
		organizationName: string;
		isAuthenticated: boolean;
		/**
		 * The org's contact channel, forwarded to the plan cards — only an OFFLINE
		 * plan has anything to do with it. Carried as two fields rather than the
		 * whole org record: these cards are handed exactly what they render.
		 */
		contactMethod?: ContactMethod;
		contactEmail?: string | null;
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
		contactMethod = 'none',
		contactEmail = null,
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
	const plans = $derived([...tier.plans].sort((a, b) => Number(a.price) - Number(b.price)));

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
	 * The cheapest plan whose card could offer a CTA at all — the one a blocked
	 * gate has something to WITHDRAW (#733/#734). Offline, sold-out and paused
	 * cards never render a Subscribe button in the first place (`PlanCard` stops
	 * at each of those above its gate branches), so they are not candidates.
	 *
	 * Kept as the FIRST choice of plan to ask about, not merely as a filter: for
	 * every tier that has one, the question below is byte-identical to the one
	 * asked before #740, so no existing card's verdict — or cache key — moves.
	 */
	const subscribablePlanId = $derived(
		plans.find(
			(p) => !!p.id && p.payment_method !== 'offline' && !p.sold_out && p.sales_status !== 'paused'
		)?.id ?? null
	);

	/**
	 * The plan the gate verdict is asked ABOUT, and why one plan can answer for
	 * all of them.
	 *
	 * A plan is REQUIRED whenever the tier sells one: with no `plan_id` the
	 * backend's gate #6 short-circuits any monetized tier with
	 * `tier_requires_subscription` and never reaches the questionnaire and
	 * approval gates at all — the same verdict whether the viewer has never
	 * started, is awaiting review, or has passed. Given a plan, the gates that do
	 * run above the payment one are facts about the (viewer, tier) pair,
	 * identical for every plan on the card; `isBlockedByMembershipGate` keeps only
	 * those, so the choice of plan cannot leak into what is withdrawn.
	 *
	 * Which is why ASKING and WITHDRAWING are no longer the same list. #740: a
	 * tier whose only plan is OFFLINE has no Subscribe to withdraw, so it asked
	 * nothing — and then had no verdict with which to report the viewer's own
	 * state either, which is the whole bug. Any plan on the card will do for the
	 * question: they are all `is_active` (the public listing only serializes
	 * those), so gate #6 lets them through, and every plan-specific stop —
	 * offline, paused, at cap — lives in gate #10, BELOW the gates being read
	 * here. A plan-less tier keeps asking a tier-only question, which is correct
	 * there: gate #6 only short-circuits a tier that HAS an active plan.
	 */
	const askPlanId = $derived(subscribablePlanId ?? plans.find((p) => !!p.id)?.id ?? null);

	const gateQueryEnabled = $derived.by(() => {
		// Every operand read unconditionally, for the reason given above.
		const authed = isAuthenticated;
		const gated = isGated;
		const hasTier = !!tierId;
		// A plan to name, or no plans at all — see `askPlanId`. A tier whose plans
		// all lack ids is neither, and cannot be asked about.
		const hasPlan = !!askPlanId || plans.length === 0;
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
			planId: askPlanId,
			accessToken,
			enabled: gateQueryEnabled
		})
	);

	const gateVerdict = $derived(gateQuery.data ?? null);
	const gateAction = $derived(gateVerdict ? getMembershipGateAction(gateVerdict) : null);
	const gateReason = $derived(
		gateAction && gateVerdict ? getMembershipStatusMessage(gateVerdict) : null
	);
	// `isLoading`, not `isPending`: a disabled query stays pending forever, and
	// that would hold the Subscribe button of every ungated tier hostage.
	const gatePending = $derived(gateQuery.isLoading);

	/**
	 * Where this viewer stands against each requirement the tier states (#740).
	 *
	 * The list below used to read the TIER — `questionnaire_id` is set, therefore
	 * "a membership questionnaire is required" — which is a true statement about
	 * the tier and a false one about anybody who has already filled it in. These
	 * two say which of the tier's rules the verdict is currently talking about;
	 * `verdictMessage` is the prose, resolved by the same helper the plan cards
	 * and the CTA use, so all three cannot drift apart.
	 */
	const questionnaireState = $derived(getMembershipRequirementState('questionnaire', gateVerdict));
	const approvalState = $derived(getMembershipRequirementState('approval', gateVerdict));
	const verdictMessage = $derived(gateVerdict ? getMembershipStatusMessage(gateVerdict) : null);

	/**
	 * The plan the tier CTA asks about, and the reason it is not simply
	 * `askPlanId`.
	 *
	 * On a GATED tier the CTA has to name a plan or its verdict is a dead end:
	 * gate #6 answers a plan-less question about a monetized tier with
	 * `tier_requires_subscription` (no `next_step`), which is why #735's approval
	 * gate was unreachable from here. Naming this plan reuses the query ABOVE —
	 * same key, same fetcher, so TanStack serves both observers from one request —
	 * and the CTA and the plan cards can no longer disagree about the same viewer.
	 *
	 * Held back on an UNGATED tier deliberately: there the tier-only verdict is
	 * already correct for what that CTA says, and changing the question would
	 * change every paid tier's CTA for no gain (#735 keeps that blast radius out).
	 */
	const ctaPlanId = $derived(isGated ? askPlanId : null);

	/**
	 * The plan a pressed Apply button belongs to. One dialog per TIER rather than
	 * one per card: only one can be open at a time, and mounting it here keeps it
	 * alive while the verdict behind it moves on (the application's own
	 * invalidation flips every plan card to the waiting note while the applicant
	 * is still reading the outcome).
	 */
	let applyPlan = $state<(PublicPlanSchema & { id: string }) | null>(null);
	let applyMode = $state<'join' | 'reapply'>('join');
	let applyOpen = $state(false);

	function handleApply(plan: PublicPlanSchema & { id: string }, mode: 'join' | 'reapply'): void {
		applyPlan = plan;
		applyMode = mode;
		applyOpen = true;
	}
</script>

{#snippet badges()}
	{#if isFree}
		<StatusBadge tone="neutral" size="sm" icon={Gift} label={m['membershipTiers.freeBadge']()} />
	{/if}
{/snippet}

{#snippet meta()}
	<!-- What it takes to get in — and, once a verdict lands, where THIS viewer
	     stands against it (#740). The tier's own fields decide which lines
	     exist at all (they are facts about the tier, server-rendered and true
	     for everyone); the verdict decides what each one says.

	     A polite live region, and pre-mounted rather than injected with its
	     first message: the lines are server-rendered with the tier's standing
	     rules, the verdict arrives later over the same DOM, and a text swap
	     that moves no focus is otherwise silent for a screen-reader user
	     (WCAG 4.1.3). Every state is words — no colour, no icon-only cue. -->
	{#if tier.requires_approval || tier.questionnaire_id}
		<ul id={requirementsId} class="space-y-1.5 text-sm" aria-live="polite">
			{#if tier.requires_approval}
				<li class="flex items-start gap-2">
					<ShieldCheck class="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
					<span>
						{#if approvalState === 'status' && verdictMessage}
							{verdictMessage}
						{:else if approvalState === 'satisfied'}
							{m['membershipTiers.approvalCleared']()}
						{:else}
							{m['membershipTiers.requiresApproval']()}
						{/if}
					</span>
				</li>
			{/if}
			{#if tier.questionnaire_id}
				<li class="flex items-start gap-2">
					<ClipboardList class="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
					<span>
						{#if questionnaireState === 'status' && verdictMessage}
							<!-- Under review, on cooldown, or refused: there is nothing to
						     open, so the link goes with the copy that offered it. -->
							{verdictMessage}
						{:else if questionnaireState === 'satisfied'}
							{m['membershipTiers.questionnaireCleared']()}
						{:else}
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
									class="font-bold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
								>
									{m['membershipTiers.questionnaireLink']()}
								</a>
							{/if}
						{/if}
					</span>
				</li>
			{/if}
		</ul>
	{/if}

	{#if plans.length > 0}
		<div class="mt-4 space-y-3">
			{#each plans as plan (plan.id ?? `${tier.id}-${plan.name}`)}
				<PlanCard
					{plan}
					{isAuthenticated}
					{subscription}
					{subscriptionLoading}
					{organizationSlug}
					{organizationName}
					{contactMethod}
					{contactEmail}
					{onSubscribe}
					{gateAction}
					{gateReason}
					{gatePending}
					onApply={handleApply}
					gateRequirementsId={requirementsId}
				/>
			{/each}
		</div>
	{/if}
{/snippet}

{#snippet actions()}
	{#if showJoinCta && tierId}
		<MembershipCta
			{organizationSlug}
			{organizationName}
			{isAuthenticated}
			{tierId}
			tierName={tier.name}
			planId={ctaPlanId}
			plansInline={plans.length > 0}
		/>
	{/if}
{/snippet}

<!-- `<article>` + `aria-labelledby`, not a labelled `region`: the cards are peers
     in a list and each must announce which tier it is, but N landmarks on one
     page would drown the page's real ones.

     The card chrome itself is the shared PricingCard shell (the tier/pricing
     look is one design across buyer tickets, organizer config and membership) —
     this tier has no single price of its own, so the price slot stays empty and
     the plan cards carry the numbers. -->
<article class="h-full" aria-labelledby={headingId}>
	<PricingCard name={tier.name} {headingId} layout="stack" {badges} {meta} {actions} class="h-full">
		{#if tier.description}
			<MarkdownContent content={tier.description} class="text-sm text-muted-foreground" />
		{/if}
	</PricingCard>
</article>

<!--
	Outside the <article>, and outside every branch that could disappear beneath it:
	an application that completes calls `invalidateAll()`, and the reloaded page can
	re-render this card with a different verdict — a dialog destroyed mid-read is an
	unannounced context change that drops focus to <body> (WCAG 3.2). Re-keyed by
	plan so switching plans resets the dialog's own form and mutation state.
-->
{#if applyPlan}
	{#key applyPlan.id}
		<ApplyDialog
			open={applyOpen}
			onOpenChange={(next) => (applyOpen = next)}
			{organizationSlug}
			{organizationName}
			mode={applyMode}
			{tierId}
			tierName={tier.name}
			planId={applyPlan.id}
			planName={applyPlan.name}
		/>
	{/key}
{/if}
