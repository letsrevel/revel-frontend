<script lang="ts">
	import { tick } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { Label } from '$lib/components/ui/label';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { Armchair, Loader2, AlertCircle, DoorOpen } from '@lucide/svelte';
	import type { TierSeatPricingSchema, VenueChartSchema } from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { formatMoney } from '$lib/utils/format';
	import { SeatHoldController } from './seat-hold-controller.svelte';
	import { holdConflictMessage } from './purchase-error';
	import { estimatedSeatTotal, priceLegendEntries, unavailableCategoryIds } from './seat-pricing';
	import { buildSeatViews } from './seating-view';
	import SeatSelector from './SeatSelector.svelte';
	import SeatMap from './SeatMap.svelte';
	import SeatViewToggle from './SeatViewToggle.svelte';
	import {
		defaultSeatViewMode,
		readSeatViewPref,
		standingCountsFrom,
		writeSeatViewPref,
		type SeatViewMode
	} from './seat-view-toggle';

	interface Props {
		isUserChoiceSeat: boolean;
		isBestAvailable: boolean;
		tierVenue: { name: string } | null;
		tierSector: { id?: string | null; name: string } | null;
		eventId: string;
		quantity: number;
		isProcessing: boolean;
		/** Parent validation error ("select N more seats"). */
		seatSelectionError: string;
		/** Parent-set failure message for a best-available hold. */
		bestAvailableError: string;
		accessibleRequired: boolean;
		onAccessibleRequiredChange: (value: boolean) => void;
		/** Hands the seat-hold controller up to the dialog (confirm/close lifecycle). */
		onController: (controller: SeatHoldController) => void;
		/** Server-resolved per-category prices (user_choice tiers, #668). */
		seatPricing?: TierSeatPricingSchema | null;
		/** Tier currency for price display (seat_pricing carries bare decimals). */
		currency?: string | null;
	}

	const {
		isUserChoiceSeat,
		isBestAvailable,
		tierVenue,
		tierSector,
		eventId,
		quantity,
		isProcessing,
		seatSelectionError,
		bestAvailableError,
		accessibleRequired,
		onAccessibleRequiredChange,
		onController,
		seatPricing = null,
		currency = null
	}: Props = $props();

	// Inline 409-conflict message (a seat was grabbed between render and tap)
	let conflictMessage = $state('');
	// Focus target for the conflict alert: the seat button the user pressed
	// becomes disabled when the failed hold resolves, which would silently drop
	// keyboard focus to <body> (WCAG 2.4.3) — so we move it to the alert.
	let conflictAlertEl = $state<HTMLDivElement>();

	// This component only mounts while the dialog is open (bits-ui unmounts
	// DialogContent when closed), so instantiating here scopes the queries and
	// holds to the open dialog. createQuery requires component-init context.
	// The mode/eventId props are fixed for a mounted dialog instance, so
	// capturing their initial values here is deliberate.
	// svelte-ignore state_referenced_locally
	const controller =
		isUserChoiceSeat || isBestAvailable
			? new SeatHoldController({
					eventId,
					getQuantity: () => quantity,
					isAuthenticated: () => !!authStore.accessToken,
					onConflict: (_seatIds, reason) => {
						conflictMessage = holdConflictMessage(reason);
						void tick().then(() => conflictAlertEl?.focus());
					}
				})
			: null;

	$effect(() => {
		if (controller) onController(controller);
	});

	const chart = $derived(controller?.chartQuery.data ?? null);
	const availability = $derived(controller?.availabilityQuery.data ?? null);
	const isLoadingSeats = $derived(
		!!controller && (controller.chartQuery.isPending || controller.availabilityQuery.isPending)
	);
	const seatLoadFailed = $derived(
		!!controller && (controller.chartQuery.isError || controller.availabilityQuery.isError)
	);

	/** Active seat ids in this tier's sector (all seated sectors when unset). */
	function collectValidSeatIds(venueChart: VenueChartSchema): Set<string> {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- not reactive state: built fresh per call and consumed synchronously
		const ids = new Set<string>();
		for (const sector of venueChart.sectors ?? []) {
			// Standing sectors are never valid (their spots can't be held), even
			// when a misconfigured tier targets one explicitly — mirrors
			// buildSeatViews, so such a tier degrades to the empty state.
			if (
				(sector.kind ?? 'seated') === 'standing' ||
				(tierSector?.id ? sector.id !== tierSector.id : false)
			) {
				continue;
			}
			for (const seat of sector.seats ?? []) {
				if (seat.is_active !== false) ids.add(seat.id);
			}
		}
		return ids;
	}

	// Seed the selection from the server's my_holds once chart + availability
	// are loaded (intersected with this sector's seats, capped to quantity).
	let seeded = false;
	$effect(() => {
		if (seeded || !controller || !isUserChoiceSeat || !chart || !availability) return;
		seeded = true;
		controller.seedFromAvailability(collectValidSeatIds(chart));
	});

	// Categories the tier can't sell (painted after the tier was saved): their
	// seats render blocked — checkout would refuse them (#668).
	const blockedCategoryIds = $derived(unavailableCategoryIds(seatPricing));

	const seatViews = $derived.by(() => {
		if (!controller || !chart || !availability) return [];
		return buildSeatViews(chart, availability, {
			sectorId: tierSector?.id ?? null,
			myHolds: controller.myHolds,
			pending: controller.pendingSeatIds,
			unavailableCategoryIds: blockedCategoryIds
		});
	});

	// The map must render the SAME seats as the list: scope the chart to the
	// tier's sector so other sectors' seats don't show as crossed-out
	// "unavailable" (SeatMap has no seatViews filter of its own).
	const mapChart = $derived.by(() => {
		if (!chart || !tierSector?.id) return chart;
		return { ...chart, sectors: (chart.sectors ?? []).filter((s) => s.id === tierSector.id) };
	});

	const heldCount = $derived(controller?.myHolds.length ?? 0);

	function handleToggle(seatId: string): void {
		conflictMessage = '';
		void controller?.toggleSeat(seatId);
	}

	// Map/List view: an explicit choice (this tap or an earlier one this
	// session) wins; otherwise the default derives from chart complexity (map
	// for multi-sector/shaped/large charts, list for small single-sector ones).
	let explicitViewMode = $state<SeatViewMode | null>(readSeatViewPref());
	const seatViewMode = $derived(explicitViewMode ?? (chart ? defaultSeatViewMode(chart) : 'list'));

	function handleViewModeChange(mode: SeatViewMode): void {
		explicitViewMode = mode;
		writeSeatViewPref(mode);
	}

	const standingCounts = $derived(standingCountsFrom(availability?.standing));

	// --- per-seat-category pricing (#668) -----------------------------------
	const legendEntries = $derived(priceLegendEntries(seatPricing, chart, tierSector?.id ?? null));
	// Legend only earns its space when prices actually differ by seat.
	const showPriceLegend = $derived(
		legendEntries.length > 1 || legendEntries.some((entry) => !entry.available)
	);
	/** Display estimate — the authoritative amount is computed at checkout. */
	const estimatedTotal = $derived(
		estimatedSeatTotal(seatPricing, chart, controller?.myHolds ?? [])
	);
</script>

{#if isUserChoiceSeat}
	<!-- Seat Selection UI for user_choice mode (selection = server hold) -->
	<div class="space-y-3">
		<div class="flex items-center justify-between">
			<span class="flex items-center gap-2 text-sm font-medium leading-none">
				<Armchair class="h-4 w-4" />
				{m['ticketConfirmationDialog.selectSeats']()}
			</span>
			<span aria-live="polite" class="text-sm text-muted-foreground">
				{heldCount} / {quantity}
				{m['ticketConfirmationDialog.seatsSelected']()}
			</span>
		</div>

		{#if tierVenue || tierSector}
			<p class="text-sm text-muted-foreground">
				{#if tierVenue}
					<span class="font-medium">{tierVenue.name}</span>
				{/if}
				{#if tierSector}
					<span> - {tierSector.name}</span>
				{/if}
			</p>
		{/if}

		{#if isLoadingSeats}
			<div class="flex items-center justify-center py-8">
				<Loader2 class="h-6 w-6 animate-spin text-muted-foreground" />
				<span class="ml-2 text-sm text-muted-foreground">
					{m['ticketConfirmationDialog.loadingSeats']()}
				</span>
			</div>
		{:else if seatLoadFailed}
			<Alert variant="destructive">
				<AlertCircle class="h-4 w-4" />
				<AlertDescription>{m['ticketConfirmationDialog.errorLoadSeats']()}</AlertDescription>
			</Alert>
		{:else if seatViews.length === 0}
			<Alert>
				<AlertCircle class="h-4 w-4" />
				<AlertDescription>
					{m['ticketConfirmationDialog.noSeatsAvailable']()}
				</AlertDescription>
			</Alert>
		{:else}
			<!-- Map/List toggle sits OUTSIDE the map surface (touch-action: none
			     there), so the dialog stays scrollable from this row on mobile. -->
			<div class="flex justify-end">
				<SeatViewToggle mode={seatViewMode} onModeChange={handleViewModeChange} />
			</div>
			{#if showPriceLegend}
				<!-- Price legend: color always paired with name/price text (#668).
				     Swatches mirror the map's category ring on an available seat. -->
				<ul class="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label={m['seatPricing.legend']()}>
					{#each legendEntries as entry (entry.id ?? 'unpainted')}
						<li class="flex items-center gap-1.5">
							<span
								class="inline-block h-3 w-3 shrink-0 rounded-full border-2 bg-background"
								style={entry.color ? `border-color: ${entry.color}` : undefined}
								class:border-border={!entry.color}
								aria-hidden="true"
							></span>
							<span class="text-muted-foreground">
								{entry.name ?? m['seatPricing.standardSeats']()}
							</span>
							{#if entry.available && entry.price != null}
								<span class="font-medium">{formatMoney(entry.price, currency)}</span>
							{:else}
								<span class="text-muted-foreground">{m['seatPricing.notAvailable']()}</span>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
			{#if seatViewMode === 'map' && mapChart}
				<!-- Tall map surface (the seated dialog widens for it); pan/zoom
				     reaches anything beyond the box. -->
				<div
					class="h-[58vh] shrink-0 overflow-hidden rounded-lg border border-border bg-background"
				>
					<SeatMap
						chart={mapChart}
						seats={seatViews}
						onToggle={handleToggle}
						maxReached={heldCount >= quantity}
						disabled={isProcessing}
						{standingCounts}
						{seatPricing}
						{currency}
					/>
				</div>
				<!-- Hold notice for the map view (the list renders its own inside
				     SeatSelector); region exists before content so it announces. -->
				<p role="status" class="text-center text-xs text-muted-foreground">
					{#if heldCount > 0}
						{m['seatSelector.heldForTenMinutes']()}
					{/if}
				</p>
			{:else}
				<!-- Seat Selection Grid (SeatSelector caps its own grid height so the
				     hold notice and legend stay visible) -->
				<div class="rounded-lg border border-border bg-background p-3">
					<SeatSelector
						seats={seatViews}
						onToggle={handleToggle}
						maxReached={heldCount >= quantity}
						disabled={isProcessing}
						{seatPricing}
						{currency}
					/>
				</div>
			{/if}
			{#if estimatedTotal !== null}
				<!-- Estimate only: the charged amount is computed at checkout under the
				     tier lock (holds never lock a price, #668). -->
				<p aria-live="polite" class="text-right text-sm font-medium">
					{m['seatPricing.selectedSeatsTotal']({ total: formatMoney(estimatedTotal, currency) })}
				</p>
			{/if}
			<!-- 409 conflict + validation errors (polite live region) -->
			<div aria-live="polite">
				{#if conflictMessage}
					<div bind:this={conflictAlertEl} tabindex="-1" class="focus:outline-none">
						<Alert variant="destructive" class="mt-3">
							<AlertCircle class="h-4 w-4" />
							<AlertDescription>{conflictMessage}</AlertDescription>
						</Alert>
					</div>
				{/if}
				{#if seatSelectionError}
					<Alert variant="destructive" class="mt-3">
						<AlertCircle class="h-4 w-4" />
						<AlertDescription>{seatSelectionError}</AlertDescription>
					</Alert>
				{/if}
			</div>
		{/if}
	</div>
{:else if isBestAvailable}
	<!-- Best-available mode: no seat picking, server assigns an adjacent block -->
	<div class="rounded-lg border border-border bg-muted/30 p-4">
		<div class="flex items-start gap-3">
			<Armchair class="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
			<div class="flex-1 space-y-1">
				<p class="font-medium text-foreground">
					{m['ticketConfirmationDialog.bestAvailableTitle']()}
				</p>
				<p class="text-sm text-muted-foreground">
					{m['ticketConfirmationDialog.bestAvailableDesc']()}
				</p>
				{#if tierVenue || tierSector}
					<p class="mt-2 text-sm">
						{#if tierVenue}
							<span class="font-medium">{tierVenue.name}</span>
						{/if}
						{#if tierSector}
							<span class="text-muted-foreground">
								{tierVenue ? ' - ' : ''}{tierSector.name}
							</span>
						{/if}
					</p>
				{/if}
				<div class="mt-3 flex items-center gap-2">
					<Checkbox
						id="accessible-seats-required"
						checked={accessibleRequired}
						onCheckedChange={(checked) => onAccessibleRequiredChange(checked === true)}
						disabled={isProcessing}
					/>
					<Label for="accessible-seats-required" class="cursor-pointer text-sm font-normal">
						{m['ticketConfirmationDialog.accessibleSeatsLabel']()}
					</Label>
				</div>
			</div>
		</div>
	</div>
	<div aria-live="polite">
		{#if bestAvailableError}
			<Alert variant="destructive">
				<AlertCircle class="h-4 w-4" />
				<AlertDescription>{bestAvailableError}</AlertDescription>
			</Alert>
		{/if}
	</div>
{:else if tierVenue}
	<!-- General Entrance with venue info -->
	<div class="rounded-lg border border-border bg-muted/30 p-4">
		<div class="flex items-start gap-3">
			<DoorOpen class="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
			<div class="space-y-1">
				<p class="font-medium text-foreground">
					{m['ticketConfirmationDialog.generalEntrance']()}
				</p>
				<p class="text-sm text-muted-foreground">
					{m['ticketConfirmationDialog.generalEntranceDesc']()}
				</p>
				<p class="mt-2 text-sm font-medium">{tierVenue.name}</p>
			</div>
		</div>
	</div>
{/if}
