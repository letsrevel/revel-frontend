<script lang="ts">
	/**
	 * Map-first tier selection (#679): a whole-venue overview where every
	 * sector shows which tier(s) sell it at what price. A sector sold by
	 * EXACTLY ONE purchasable user_choice tier renders its seats directly
	 * selectable (real server holds, Continue hands them to the purchase
	 * dialog — see VenueOverviewMap); other sold sectors route into the
	 * existing purchase flow — 1:1 sectors go straight to the tier's dialog,
	 * sectors sold by several tiers open a small chooser first. Sectors sold
	 * by no purchasable tier render ghosted and inert.
	 */
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery } from '@tanstack/svelte-query';
	import { eventpublicseatingGetChart } from '$lib/api';
	import type { TierRemainingTicketsSchema, VenueChartSchema } from '$lib/api/generated/types.gen';
	import type { TierSchemaWithId } from '$lib/types/tickets';
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogDescription
	} from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import VenueOverviewMap from './VenueOverviewMap.svelte';
	import { Map as MapIcon } from '@lucide/svelte';
	import {
		buildSectorOverview,
		seatSellingTier,
		type SectorOverviewEntry,
		type SectorTierMode
	} from './venue-overview';

	interface Props {
		open: boolean;
		eventId: string;
		tiers: TierSchemaWithId[];
		isAuthenticated: boolean;
		canAttendWithoutLogin?: boolean;
		/** Per-tier remaining tickets info (my-status endpoint), when known. */
		tierRemainingTickets?: TierRemainingTicketsSchema[];
		/** Event-level max tickets per user (seat-selection cap fallback). */
		eventMaxTicketsPerUser?: number | null;
		/** Route an authenticated buyer into the tier's purchase dialog. */
		onSelectTier: (tier: TierSchemaWithId) => void;
		/** Route a guest buyer into the guest ticket dialog (same as TierCard). */
		onGuestTierClick?: (tier: TierSchemaWithId) => void;
	}

	let {
		open = $bindable(),
		eventId,
		tiers,
		isAuthenticated,
		canAttendWithoutLogin = false,
		tierRemainingTickets,
		eventMaxTicketsPerUser = null,
		onSelectTier,
		onGuestTierClick
	}: Props = $props();

	const CHART_STALE_TIME_MS = 5 * 60 * 1000;

	// Same query key/staleTime as SeatHoldController, so the purchase dialogs,
	// the seat layer and this shell share one cached chart (the shell only
	// needs it for the venue name + chooser entries). Fetched lazily on open.
	const chartQuery = createQuery<VenueChartSchema, Error>(() => ({
		queryKey: ['seating-chart', eventId],
		staleTime: CHART_STALE_TIME_MS,
		enabled: open,
		queryFn: async () => {
			const response = await eventpublicseatingGetChart({ path: { event_id: eventId } });
			if (response.error !== undefined || !response.data) {
				throw new Error('Failed to load seating chart');
			}
			return response.data;
		}
	}));

	const entries = $derived.by((): SectorOverviewEntry[] => {
		const chart = chartQuery.data;
		if (!chart) return [];
		return buildSectorOverview(chart, tiers, { remaining: tierRemainingTickets });
	});

	// Buyers who must sign in first (mirrors TierCard's login-CTA branch): the
	// chooser doubles as the sector detail sheet with a sign-in CTA.
	const needsLogin = $derived(!isAuthenticated && !canAttendWithoutLogin);

	// Seat-level selection available? Then the hint invites tapping seats too.
	const hasSelectableSeats = $derived(
		!needsLogin && entries.some((entry) => seatSellingTier(entry) !== null)
	);
	const hintText = $derived(
		hasSelectableSeats ? m['venueOverview.hintWithSeats']() : m['venueOverview.hint']()
	);

	// 1:N chooser state (also used for 1:1 when sign-in is required).
	let chooserEntry = $state<SectorOverviewEntry | null>(null);
	let chooserOpen = $state(false);

	function handleSectorSelect(sectorId: string): void {
		const entry = entries.find((candidate) => candidate.sectorId === sectorId);
		if (!entry || entry.options.length === 0) return;
		if (entry.options.length === 1 && !needsLogin) {
			route(entry.options[0].tier);
			return;
		}
		chooserEntry = entry;
		chooserOpen = true;
	}

	function closeChooser(): void {
		chooserOpen = false;
		chooserEntry = null;
	}

	/** Close the overview surfaces, then hand off to the page's purchase path. */
	function route(tier: TierSchemaWithId): void {
		closeChooser();
		open = false;
		if (!isAuthenticated && canAttendWithoutLogin) {
			onGuestTierClick?.(tier);
		} else {
			onSelectTier(tier);
		}
	}

	function modeHint(mode: SectorTierMode): string {
		if (mode === 'user_choice') return m['venueOverview.modeUserChoice']();
		if (mode === 'best_available') return m['venueOverview.modeBestAvailable']();
		return m['venueOverview.modeGeneral']();
	}

	// Keep chooser state from leaking across dialog opens.
	$effect(() => {
		if (!open) closeChooser();
	});
</script>

<Dialog bind:open>
	<DialogContent class="flex h-[85vh] max-w-4xl flex-col">
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2 text-2xl">
				<MapIcon class="h-6 w-6" aria-hidden="true" />
				{m['venueOverview.title']()}
			</DialogTitle>
			<DialogDescription>
				{#if chartQuery.data}
					{chartQuery.data.venue_name} — {hintText}
				{:else}
					{hintText}
				{/if}
			</DialogDescription>
		</DialogHeader>

		<!-- Seat layer + targets; mounts only while the dialog is open, so its
		     hold controller releases un-handed-off holds on close. -->
		<VenueOverviewMap
			{eventId}
			{tiers}
			{needsLogin}
			{tierRemainingTickets}
			{eventMaxTicketsPerUser}
			onSectorTarget={handleSectorSelect}
			onContinue={route}
		/>
	</DialogContent>
</Dialog>

<!-- Sector chooser: one sector sold by several tiers (or sign-in required). -->
{#if chooserEntry}
	<Dialog
		bind:open={chooserOpen}
		onOpenChange={(isOpen) => {
			if (!isOpen) closeChooser();
		}}
	>
		<DialogContent class="max-w-md">
			<DialogHeader>
				<DialogTitle>
					{m['venueOverview.chooserTitle']({ sector: chooserEntry.sectorName })}
				</DialogTitle>
			</DialogHeader>
			<ul class="mt-2 space-y-2">
				{#each chooserEntry.options as option (option.tier.id)}
					<li>
						{#if needsLogin}
							<div class="rounded-lg border border-border p-3">
								<span class="block font-medium">{option.tier.name}</span>
								<span class="block text-sm font-semibold text-primary">{option.priceDisplay}</span>
								<span class="block text-xs text-muted-foreground">{modeHint(option.mode)}</span>
							</div>
						{:else}
							<button
								type="button"
								class="w-full rounded-lg border border-border p-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
								onclick={() => route(option.tier)}
							>
								<span class="block font-medium">{option.tier.name}</span>
								<span class="block text-sm font-semibold text-primary">{option.priceDisplay}</span>
								<span class="block text-xs text-muted-foreground">{modeHint(option.mode)}</span>
							</button>
						{/if}
					</li>
				{/each}
			</ul>
			{#if needsLogin}
				<Button href="/login" class="mt-2 w-full">{m['tierCardAdmin.signInToGetTicket']()}</Button>
			{/if}
		</DialogContent>
	</Dialog>
{/if}
