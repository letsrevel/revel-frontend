<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { eventadminListTicketTiers } from '$lib/api/generated/sdk.gen';
	import type { TicketTierDetailSchema } from '$lib/api/generated/types.gen';
	import { Button } from '$lib/components/ui/button';
	import { Ticket, CheckSquare, Users } from 'lucide-svelte';
	import TierCard from './TierCard.svelte';
	import TierForm from './TierForm.svelte';
	import type { EventFormData } from './types';

	interface Props {
		eventId: string;
		organizationStripeConnected: boolean;
		formData: EventFormData;
		onUpdate: (updates: Partial<EventFormData>) => void;
		onBack: () => void;
		onNext: () => void;
	}

	let { eventId, organizationStripeConnected, formData, onUpdate, onBack, onNext }: Props =
		$props();

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

	let tiers = $derived(tiersQuery.data?.data?.results ?? []);

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
		<h2 class="text-2xl font-bold">Ticketing Configuration</h2>
		<p class="text-muted-foreground">Configure ticketing options and manage ticket tiers</p>
	</div>

	<!-- Event-Level Ticketing Options -->
	<div class="space-y-4 rounded-lg border border-border p-4">
		<h3 class="flex items-center gap-2 font-semibold">
			<Users class="h-5 w-5" aria-hidden="true" />
			Ticketing Options
		</h3>

		<!-- Free for Members -->
		<label
			class="flex cursor-pointer items-center gap-3 rounded-md border border-input p-3 transition-colors hover:bg-accent"
		>
			<input
				type="checkbox"
				checked={formData.free_for_members || false}
				onchange={(e) => onUpdate({ free_for_members: e.currentTarget.checked })}
				class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-ring"
			/>
			<div class="flex-1">
				<div class="font-medium">Free for Members</div>
				<div class="text-sm text-muted-foreground">
					Organization members don't need to pay for tickets
				</div>
			</div>
		</label>

		<!-- Free for Staff -->
		<label
			class="flex cursor-pointer items-center gap-3 rounded-md border border-input p-3 transition-colors hover:bg-accent"
		>
			<input
				type="checkbox"
				checked={formData.free_for_staff || false}
				onchange={(e) => onUpdate({ free_for_staff: e.currentTarget.checked })}
				class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-ring"
			/>
			<div class="flex-1">
				<div class="font-medium">Free for Staff</div>
				<div class="text-sm text-muted-foreground">Staff members don't need to pay for tickets</div>
			</div>
		</label>
	</div>

	<!-- Ticket Tiers Section -->
	<div>
		<h3 class="mb-4 font-semibold">Ticket Tiers</h3>
		<p class="mb-4 text-sm text-muted-foreground">
			Create different ticket types with varying prices, quantities, and access levels
		</p>
	</div>

	{#if tiersQuery.isLoading}
		<div class="flex items-center justify-center py-12">
			<div class="text-center">
				<div class="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
				<p class="mt-2 text-sm text-muted-foreground">Loading tiers...</p>
			</div>
		</div>
	{:else if tiersQuery.isError}
		<div class="rounded-lg border border-destructive bg-destructive/10 p-4" role="alert">
			<p class="font-medium text-destructive">Error loading ticket tiers</p>
			<p class="mt-1 text-sm text-destructive/90">
				{tiersQuery.error?.message || 'An error occurred. Please try again.'}
			</p>
			{#if tiersQuery.error?.body?.detail}
				<div class="mt-2 space-y-1">
					{#if Array.isArray(tiersQuery.error.body.detail)}
						{#each tiersQuery.error.body.detail as detail}
							<p class="text-xs text-destructive/80">
								• {detail.loc ? detail.loc.join(' → ') + ': ' : ''}{detail.msg}
							</p>
						{/each}
					{:else if typeof tiersQuery.error.body.detail === 'string'}
						<p class="text-xs text-destructive/80">{tiersQuery.error.body.detail}</p>
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
				<p class="text-muted-foreground">No ticket tiers found for this event</p>
				<p class="mt-1 text-sm text-muted-foreground">
					The default "General Admission" tier should have been created automatically
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
		<span class="text-lg">+ Add Another Tier</span>
		<p class="mt-1 text-sm text-muted-foreground">
			Create VIP, Student, Early Bird, or other ticket types
		</p>
	</button>

	<!-- Navigation -->
	<div class="flex justify-between border-t border-border pt-6">
		<Button variant="outline" onclick={onBack}>← Back</Button>
		<Button onclick={onNext}>Save & Exit</Button>
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
