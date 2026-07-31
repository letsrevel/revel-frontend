<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { onMount, tick } from 'svelte';
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import { createQuery } from '@tanstack/svelte-query';
	import type {
		MembershipStatus,
		MembershipTierSchema,
		OrganizationRetrieveSchema,
		PublicMembershipTierSchema,
		PublicPlanSchema
	} from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { myOrgSubscriptionQueryOptions } from '$lib/queries/my-org-subscription';
	import MarkdownContent from '$lib/components/common/MarkdownContent.svelte';
	import MembershipCta from './MembershipCta.svelte';
	import TierCard from './TierCard.svelte';
	import SubscribeDialog from './SubscribeDialog.svelte';
	import CheckoutReturnCard from './CheckoutReturnCard.svelte';

	interface Props {
		organization: OrganizationRetrieveSchema;
		/**
		 * Every tier the org offers, already in `display_order` from the backend.
		 *
		 * Deliberately the tier listing and not the plan listing: grouping plans by
		 * tier — what this component used to do — renders zero cards for a tier
		 * with no plan, which is exactly the free/gated tier a member is supposed
		 * to be able to choose (#720).
		 */
		tiers: PublicMembershipTierSchema[];
		isAuthenticated: boolean;
		/** The viewer's standing in the org, from the server load. */
		isMember?: boolean;
		membershipTier?: MembershipTierSchema | null;
		membershipStatus?: MembershipStatus | null;
		isOwner?: boolean;
		isStaff?: boolean;
	}

	const {
		organization,
		tiers,
		isAuthenticated,
		isMember = false,
		membershipTier = null,
		membershipStatus = null,
		isOwner = false,
		isStaff = false
	}: Props = $props();

	const accessToken = $derived(authStore.accessToken);

	/**
	 * The viewer's own subscription in this org — the same query key
	 * `OrgMembershipInline` and `CheckoutReturnCard` already use, so TanStack
	 * serves every observer from one request and one invalidation refreshes them
	 * all.
	 *
	 * Without it the grid offered "Subscribe" to people who already pay: the
	 * backend refuses a second non-terminal subscription with a 400, so that
	 * button could only ever fail after quoting a concrete charge.
	 */
	const subQuery = createQuery(() => myOrgSubscriptionQueryOptions(organization.id, accessToken));

	const subscription = $derived(subQuery.data ?? null);
	// `isLoading`, not `isPending`: a disabled query (logged-out visitor) stays
	// pending forever and would leave every CTA disabled.
	const subscriptionLoading = $derived(subQuery.isLoading);

	/** Which Stripe return URL the visitor landed on, if any. */
	let returnOutcome = $state<'success' | 'cancelled' | null>(null);
	let sectionEl = $state<HTMLElement | null>(null);

	/**
	 * Owners and staff already have standing here; the page is configuration to
	 * them, not an offer. Suppressing the per-tier CTA also spares them one
	 * eligibility round trip per tier for a question they never asked — their
	 * badge is rendered once, above the grid.
	 */
	const showJoinCtas = $derived.by(() => {
		// Both operands read unconditionally: `||` inside a `$derived` would leave
		// the skipped one untracked.
		const owner = isOwner;
		const staff = isStaff;
		return !owner && !staff;
	});

	/** The viewer's standing, shown once rather than repeated on every card. */
	const hasStanding = $derived.by(() => {
		const owner = isOwner;
		const staff = isStaff;
		const member = isMember;
		return owner || staff || member;
	});

	const refundPolicy = $derived(
		organization.membership_refund_policy?.trim() ? organization.membership_refund_policy : null
	);

	let selectedPlan = $state<(PublicPlanSchema & { id: string }) | null>(null);
	let dialogOpen = $state(false);

	function handleSubscribe(plan: PublicPlanSchema & { id: string }): void {
		selectedPlan = plan;
		dialogOpen = true;
	}

	onMount(() => {
		if (!browser) return;
		const params = new URLSearchParams(window.location.search);
		const success = params.has('membership_success');
		const cancelled = params.has('membership_cancelled');
		if (!success && !cancelled) return;

		returnOutcome = success ? 'success' : 'cancelled';
		// The flag has been consumed; leaving it in the URL would replay the
		// card on every reload and on back-navigation.
		//
		// Deliberately the raw history API, not $app/navigation's replaceState:
		// the latter throws "Cannot call replaceState(...) before router is
		// initialized" when called from onMount during hydration, which aborts
		// the batch flush so CheckoutReturnCard never renders. The house idiom
		// for stripping a consumed param in onMount is this raw call (see
		// StripeConnect.svelte, the event detail page, event-series admin); the
		// SvelteKit dev warning is the accepted trade-off.
		window.history.replaceState(
			{},
			'',
			resolve('/(public)/org/[slug]/membership', { slug: organization.slug })
		);

		// The card mounts on the next flush, so the scroll waits for it —
		// otherwise the section is measured at its pre-card height.
		void tick().then(() => {
			sectionEl?.scrollIntoView?.({ block: 'start' });
		});
	});
</script>

<section
	id="membership"
	aria-labelledby="membership-heading"
	class="space-y-6"
	bind:this={sectionEl}
>
	{#if returnOutcome && isAuthenticated}
		<!-- Authenticated only: the card polls `me/subscriptions`, so a logged
		     out visitor landing here would watch a spinner forever. -->
		<CheckoutReturnCard
			organizationId={organization.id}
			organizationSlug={organization.slug}
			outcome={returnOutcome}
		/>
	{/if}

	<div class="space-y-2">
		<h1 id="membership-heading" class="text-3xl font-bold tracking-tight md:text-4xl">
			{m['membershipTiers.heading']()}
		</h1>
		<p class="text-muted-foreground">
			{m['membershipTiers.subtitle']({ organizationName: organization.name })}
		</p>
	</div>

	{#if hasStanding}
		<!-- Summary mode (no tierId): the badge branches only, no eligibility
		     request — the props already answer the question. -->
		<MembershipCta
			organizationSlug={organization.slug}
			organizationName={organization.name}
			{isAuthenticated}
			{isMember}
			{membershipTier}
			{membershipStatus}
			{isOwner}
			{isStaff}
		/>
	{/if}

	{#if tiers.length === 0}
		<p class="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
			{m['membershipTiers.empty']({ organizationName: organization.name })}
		</p>
	{:else}
		<div aria-labelledby="tiers-heading">
			<h2 id="tiers-heading" class="sr-only">{m['membershipTiers.tiersHeading']()}</h2>
			<div class="grid gap-4 sm:grid-cols-2">
				{#each tiers as tier (tier.id ?? tier.name)}
					<TierCard
						{tier}
						organizationSlug={organization.slug}
						organizationName={organization.name}
						{isAuthenticated}
						contactMethod={organization.contact_method}
						contactEmail={organization.contact_email}
						{subscription}
						{subscriptionLoading}
						onSubscribe={handleSubscribe}
						showJoinCta={showJoinCtas}
					/>
				{/each}
			</div>
		</div>
	{/if}

	{#if refundPolicy}
		<details class="rounded-lg border p-3">
			<summary
				class="cursor-pointer text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			>
				{m['membershipPlans.refundPolicy']()}
			</summary>
			<MarkdownContent
				content={refundPolicy}
				ariaLabel={m['membershipPlans.refundPolicy']()}
				class="mt-2 text-sm"
			/>
		</details>
	{/if}
</section>

{#if selectedPlan}
	<!-- Mounted outside the section so a closed dialog keeps its error state,
	     and re-keyed by plan so switching plans resets the mutation. -->
	{#key selectedPlan.id}
		<SubscribeDialog
			open={dialogOpen}
			onOpenChange={(next) => (dialogOpen = next)}
			plan={selectedPlan}
			tierName={selectedPlan.tier_name}
			organizationId={organization.id}
			organizationSlug={organization.slug}
			organizationName={organization.name}
			{refundPolicy}
			gracePeriodDays={organization.membership_grace_period_days}
			revivalWindowDays={organization.membership_subscription_revival_window_days}
		/>
	{/key}
{/if}
