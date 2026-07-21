<script lang="ts">
	/**
	 * Map-first tier selection (#679): a whole-venue overview where every
	 * sector shows which tier(s) sell it at what price. Picking a sector routes
	 * into the existing purchase flow — 1:1 sectors go straight to the tier's
	 * dialog, sectors sold by several tiers open a small chooser first.
	 * Sectors sold by no purchasable tier render ghosted and inert.
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
	import SeatMap from '$lib/components/tickets/SeatMap.svelte';
	import { Loader2, Map as MapIcon } from '@lucide/svelte';
	import {
		buildSectorOverview,
		parseStageMetadata,
		type SectorOverviewEntry,
		type SectorTarget,
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
		onSelectTier,
		onGuestTierClick
	}: Props = $props();

	const CHART_STALE_TIME_MS = 5 * 60 * 1000;

	// Same query key/staleTime as SeatHoldController, so the purchase dialogs
	// and the overview share one cached chart. Fetched lazily on first open.
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

	// Sector click targets for SeatMap's overview mode: accessible name and
	// visible overlay both carry the tier name(s) + price(s).
	const sectorTargets = $derived(
		entries
			.filter((entry) => entry.options.length > 0)
			.map((entry): SectorTarget => ({
				sectorId: entry.sectorId,
				label: `${entry.sectorName}: ${entry.options
					.map((option) => `${option.tier.name}, ${option.priceDisplay}`)
					.join('; ')}`,
				lines: entry.options.map((option) => `${option.tier.name} · ${option.priceDisplay}`)
			}))
	);

	const stage = $derived(chartQuery.data ? parseStageMetadata(chartQuery.data.metadata) : null);

	// Buyers who must sign in first (mirrors TierCard's login-CTA branch): the
	// chooser doubles as the sector detail sheet with a sign-in CTA.
	const needsLogin = $derived(!isAuthenticated && !canAttendWithoutLogin);

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
					{chartQuery.data.venue_name} — {m['venueOverview.hint']()}
				{:else}
					{m['venueOverview.hint']()}
				{/if}
			</DialogDescription>
		</DialogHeader>

		<div class="min-h-0 flex-1 overflow-hidden rounded-lg border bg-muted/20">
			{#if chartQuery.isPending}
				<div
					class="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground"
					role="status"
				>
					<Loader2 class="h-6 w-6 animate-spin" aria-hidden="true" />
					<p class="text-sm">{m['venueOverview.loading']()}</p>
				</div>
			{:else if chartQuery.isError || !chartQuery.data}
				<div class="flex h-full items-center justify-center p-6">
					<p class="text-sm text-destructive" role="alert">{m['venueOverview.loadError']()}</p>
				</div>
			{:else}
				<SeatMap
					chart={chartQuery.data}
					seats={[]}
					interactive={false}
					{sectorTargets}
					onSectorSelect={handleSectorSelect}
					{stage}
				/>
			{/if}
		</div>
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
