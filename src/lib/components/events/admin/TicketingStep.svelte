<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery } from '@tanstack/svelte-query';
	import {
		eventadminListTicketTiers,
		organizationadminListMembershipTiers
	} from '$lib/api/generated/sdk.gen';
	import type { TicketTierDetailSchema } from '$lib/api/generated/types.gen';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Users, Info, Ticket } from 'lucide-svelte';
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

	// Max tickets per user - stored as string for input, converted to number/null
	let maxTicketsInput = $state(formData.max_tickets_per_user?.toString() ?? '');

	function handleMaxTicketsChange(value: string) {
		maxTicketsInput = value;
		const trimmed = value.trim();
		if (trimmed === '' || trimmed === '0') {
			onUpdate({ max_tickets_per_user: null });
		} else {
			const num = parseInt(trimmed, 10);
			if (!isNaN(num) && num > 0) {
				onUpdate({ max_tickets_per_user: num });
			}
		}
	}

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

	<!-- Event-level Ticket Settings -->
	<div class="rounded-lg border border-border bg-card p-4">
		<div class="mb-4 flex items-center gap-2">
			<Ticket class="h-5 w-5 text-primary" aria-hidden="true" />
			<h3 class="font-semibold">
				{m['ticketingStep.eventTicketSettings']?.() ?? 'Event Ticket Settings'}
			</h3>
		</div>

		<div class="space-y-4">
			<div class="space-y-2">
				<Label for="max-tickets-per-user">
					{m['ticketingStep.maxTicketsPerUser']?.() ?? 'Max Tickets Per User'}
				</Label>
				<Input
					id="max-tickets-per-user"
					type="number"
					min="1"
					placeholder={m['ticketingStep.maxTicketsPlaceholder']?.() ?? 'Unlimited'}
					value={maxTicketsInput}
					oninput={(e) => handleMaxTicketsChange(e.currentTarget.value)}
					class="max-w-xs"
				/>
				<div class="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
					<Info class="mt-0.5 h-4 w-4 shrink-0" />
					<p>
						{m['ticketingStep.maxTicketsPerUserHint']?.() ??
							'Set the default maximum number of tickets a single user can purchase for this event. Leave empty for unlimited. This can be overridden on individual ticket tiers.'}
					</p>
				</div>
			</div>
		</div>
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
		{organizationSlug}
		{organizationStripeConnected}
		{membershipTiers}
		eventVenueId={formData.venue_id || null}
		onClose={handleCloseTierForm}
	/>
{/if}
