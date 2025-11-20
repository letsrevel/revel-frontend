<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery } from '@tanstack/svelte-query';
	import {
		eventadminListTicketTiers,
		organizationadminListMembershipTiers
	} from '$lib/api/generated/sdk.gen';
	import type { TicketTierDetailSchema } from '$lib/api/generated/types.gen';
	import { Button } from '$lib/components/ui/button';
	import { Users } from 'lucide-svelte';
	import TierCard from './TierCard.svelte';
	import TierForm from './TierForm.svelte';
	import { authStore } from '$lib/stores/auth.svelte';

	// EventFormData is a flexible type for form state
	interface EventFormData {
		[key: string]: any;
	}

	interface Props {
		eventId: string;
		organizationSlug: string;
		organizationStripeConnected: boolean;
		formData: EventFormData;
		onUpdate: (updates: Partial<EventFormData>) => void;
		onBack: () => void;
		onNext: () => void;
	}

	let {
		eventId,
		organizationSlug,
		organizationStripeConnected,
		formData,
		onUpdate,
		onBack,
		onNext
	}: Props = $props();

	const accessToken = $derived(authStore.accessToken);

	// Fetch ticket tiers for this event
	let tiersQuery = createQuery(() => ({
		queryKey: ['event-admin', eventId, 'ticket-tiers'],
		queryFn: () =>
			eventadminListTicketTiers({
				path: { event_id: eventId }
			})
	}));

	// Fetch membership tiers for the organization
	let membershipTiersQuery = createQuery(() => ({
		queryKey: ['organization', organizationSlug, 'membership-tiers'],
		queryFn: async () => {
			if (!accessToken) return null;
			const response = await organizationadminListMembershipTiers({
				path: { slug: organizationSlug },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			return response.data;
		},
		enabled: !!accessToken
	}));

	let editingTier = $state<TicketTierDetailSchema | null>(null);
	let showTierForm = $state(false);

	let tiers = $derived(tiersQuery.data?.data?.results ?? []);
	let membershipTiers = $derived(membershipTiersQuery.data ?? []);

	function handleEditTier(tier: TicketTierDetailSchema) {
		editingTier = tier;
		showTierForm = true;
	}

	function handleCloseTierForm() {
		showTierForm = false;
		editingTier = null;
	}
</script>

<div class="space-y-6">
	<div>
		<h2 class="text-2xl font-bold">{m['ticketingStep.ticketingConfiguration']()}</h2>
		<p class="text-muted-foreground">{m['ticketingStep.configureOptions']()}</p>
	</div>

	<!-- Ticket Tiers Section -->
	<div>
		<h3 class="mb-4 font-semibold">{m['ticketingStep.ticketTiers']()}</h3>
		<p class="mb-4 text-sm text-muted-foreground">
			{m['ticketingStep.createDifferentTiers']()}
		</p>
	</div>

	{#if tiersQuery.isLoading}
		<div class="flex items-center justify-center py-12">
			<div class="text-center">
				<div class="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
				<p class="mt-2 text-sm text-muted-foreground">{m['ticketingStep.loadingTiers']()}</p>
			</div>
		</div>
	{:else if tiersQuery.isError}
		<div class="rounded-lg border border-destructive bg-destructive/10 p-4" role="alert">
			<p class="font-medium text-destructive">{m['ticketingStep.errorLoadingTiers']()}</p>
			<p class="mt-1 text-sm text-destructive/90">
				{(tiersQuery.error as any)?.message || m['ticketingStep.genericError']()}
			</p>
			{#if (tiersQuery.error as any)?.detail}
				<div class="mt-2 space-y-1">
					{#if Array.isArray((tiersQuery.error as any).detail)}
						{#each (tiersQuery.error as any).detail as detail}
							<p class="text-xs text-destructive/80">
								• {detail.loc ? detail.loc.join(' → ') + ': ' : ''}{detail.msg}
							</p>
						{/each}
					{:else if typeof (tiersQuery.error as any).detail === 'string'}
						<p class="text-xs text-destructive/80">{(tiersQuery.error as any).detail}</p>
					{/if}
				</div>
			{/if}
		</div>
	{:else}
		<div class="space-y-4">
			{#each tiers as tier (tier.id)}
				<TierCard {tier} onEdit={() => handleEditTier(tier)} />
			{/each}
		</div>

		{#if tiers.length === 0}
			<div class="rounded-lg border border-dashed border-muted-foreground/25 p-8 text-center">
				<p class="text-muted-foreground">{m['ticketingStep.noTiersFound']()}</p>
				<p class="mt-1 text-sm text-muted-foreground">
					{m['ticketingStep.defaultTierHint']()}
				</p>
			</div>
		{/if}
	{/if}

	<!-- Add Another Tier Button -->
	<button
		type="button"
		onclick={() => {
			editingTier = null;
			showTierForm = true;
		}}
		class="w-full rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 transition-colors hover:border-muted-foreground/50"
	>
		<span class="text-lg">{m['ticketingStep.addAnotherTier']()}</span>
		<p class="mt-1 text-sm text-muted-foreground">
			{m['ticketingStep.tierExamples']()}
		</p>
	</button>

	<!-- Navigation -->
	<div class="flex justify-between border-t border-border pt-6">
		<Button variant="outline" onclick={onBack}>{m['ticketingStep.back']()}</Button>
		<Button onclick={onNext}>{m['ticketingStep.saveAndExit']()}</Button>
	</div>
</div>

{#if showTierForm}
	<TierForm
		tier={editingTier}
		{eventId}
		{organizationStripeConnected}
		{membershipTiers}
		onClose={handleCloseTierForm}
	/>
{/if}
