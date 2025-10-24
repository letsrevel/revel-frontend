<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { eventadminListTicketTiers } from '$lib/api/generated/sdk.gen';
	import type { TicketTierDetailSchema } from '$lib/api/generated/types.gen';
	import { Button } from '$lib/components/ui/button';
	import TierCard from './TierCard.svelte';
	import TierForm from './TierForm.svelte';

	interface Props {
		eventId: string;
		organizationStripeConnected: boolean;
		onBack: () => void;
		onNext: () => void;
	}

	let { eventId, organizationStripeConnected, onBack, onNext }: Props = $props();

	// Fetch ticket tiers for this event
	let tiersQuery = createQuery(() => ({
		queryKey: ['event-admin', eventId, 'ticket-tiers'],
		queryFn: () =>
			eventadminListTicketTiers({
				path: { event_id: eventId }
			})
	}));

	let editingTier = $state<TicketTierDetailSchema | null>(null);
	let showTierForm = $state(false);

	let tiers = $derived($tiersQuery.data?.data?.results ?? []);

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
		<h2 class="text-2xl font-bold">Configure Ticket Tiers</h2>
		<p class="text-muted-foreground">
			Tiers let you offer different ticket types (e.g., VIP, Student, General)
		</p>
	</div>

	{#if $tiersQuery.isLoading}
		<div class="flex items-center justify-center py-12">
			<div class="text-center">
				<div class="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
				<p class="mt-2 text-sm text-muted-foreground">Loading tiers...</p>
			</div>
		</div>
	{:else if $tiersQuery.isError}
		<div class="rounded-lg border border-destructive bg-destructive/10 p-4" role="alert">
			<p class="font-medium text-destructive">Error loading ticket tiers</p>
			<p class="text-sm text-destructive/80">
				{$tiersQuery.error?.message || 'Please try again'}
			</p>
		</div>
	{:else}
		<div class="space-y-4">
			{#each tiers as tier (tier.id)}
				<TierCard {tier} onEdit={() => handleEditTier(tier)} />
			{/each}
		</div>

		{#if tiers.length === 0}
			<div class="rounded-lg border border-dashed border-muted-foreground/25 p-8 text-center">
				<p class="text-muted-foreground">No ticket tiers found for this event</p>
				<p class="mt-1 text-sm text-muted-foreground">
					The default "General Admission" tier should have been created automatically
				</p>
			</div>
		{/if}
	{/if}

	<!-- Phase 1: Hide "Add Another Tier" button -->
	<!-- Phase 2: Uncomment this -->
	<!-- <button
		type="button"
		onclick={() => { editingTier = null; showTierForm = true; }}
		class="w-full border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 hover:border-muted-foreground/50 transition-colors"
	>
		<span class="text-lg">+ Add Another Tier</span>
		<p class="text-sm text-muted-foreground mt-1">
			Create VIP, Student, Early Bird, or other ticket types
		</p>
	</button> -->

	<!-- Navigation -->
	<div class="flex justify-between border-t border-border pt-6">
		<Button variant="outline" onclick={onBack}>← Back</Button>
		<Button onclick={onNext}>Finish & Publish →</Button>
	</div>
</div>

{#if showTierForm}
	<TierForm
		tier={editingTier}
		{eventId}
		{organizationStripeConnected}
		onClose={handleCloseTierForm}
	/>
{/if}
