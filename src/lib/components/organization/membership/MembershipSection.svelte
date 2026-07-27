<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { onMount, tick } from 'svelte';
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import type { OrganizationRetrieveSchema, PublicPlanSchema } from '$lib/api/generated/types.gen';
	import MarkdownContent from '$lib/components/common/MarkdownContent.svelte';
	import PlanCard from './PlanCard.svelte';
	import SubscribeDialog from './SubscribeDialog.svelte';
	import CheckoutReturnCard from './CheckoutReturnCard.svelte';

	interface Props {
		organization: OrganizationRetrieveSchema;
		plans: PublicPlanSchema[];
		isAuthenticated: boolean;
	}

	const { organization, plans, isAuthenticated }: Props = $props();

	/** Which Stripe return URL the visitor landed on, if any. */
	let returnOutcome = $state<'success' | 'cancelled' | null>(null);
	let sectionEl = $state<HTMLElement | null>(null);

	/**
	 * Tiers alphabetically, plans cheapest-first inside a tier: the backend
	 * order is not specified, and a shifting card order between renders is
	 * worse than an arbitrary but stable one.
	 */
	interface TierGroup {
		tierId: string;
		tierName: string;
		plans: PublicPlanSchema[];
	}

	const tierGroups = $derived.by(() => {
		// A plain record, not a Map: `svelte/prefer-svelte-reactivity` bans
		// mutable Maps, and this one is a throwaway inside the derived anyway.
		const byTier: Record<string, TierGroup> = {};
		for (const plan of plans) {
			const group = byTier[plan.tier_id];
			if (group) {
				group.plans.push(plan);
			} else {
				byTier[plan.tier_id] = {
					tierId: plan.tier_id,
					tierName: plan.tier_name,
					plans: [plan]
				};
			}
		}
		return Object.values(byTier)
			.map((group) => ({
				...group,
				plans: [...group.plans].sort((a, b) => Number(a.price) - Number(b.price))
			}))
			.sort((a, b) => a.tierName.localeCompare(b.tierName));
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
			resolve('/(public)/org/[slug]', { slug: organization.slug })
		);

		// The card mounts on the next flush, so the scroll waits for it —
		// otherwise the section is measured at its pre-card height.
		void tick().then(() => {
			sectionEl?.scrollIntoView?.({ block: 'start' });
		});
	});
</script>

{#if plans.length > 0 || returnOutcome}
	<section
		id="membership"
		aria-labelledby="membership-heading"
		class="mb-12 space-y-6"
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

		<h2 id="membership-heading" class="text-2xl font-bold">{m['membershipPlans.heading']()}</h2>

		{#each tierGroups as group (group.tierId)}
			<div class="space-y-3">
				<h3 class="text-lg font-semibold">{group.tierName}</h3>
				<div class="grid gap-4 sm:grid-cols-2">
					{#each group.plans as plan (plan.id ?? `${group.tierId}-${plan.name}`)}
						<PlanCard
							{plan}
							{isAuthenticated}
							organizationSlug={organization.slug}
							onSubscribe={handleSubscribe}
						/>
					{/each}
				</div>
			</div>
		{/each}

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
{/if}

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
			organizationName={organization.name}
			{refundPolicy}
		/>
	{/key}
{/if}
