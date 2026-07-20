<script lang="ts">
	import { tick } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { Label } from '$lib/components/ui/label';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { AlertCircle, Loader2, MapPin, Info, Armchair } from '@lucide/svelte';
	import SeatSelector from '$lib/components/tickets/SeatSelector.svelte';
	import SeatMap from '$lib/components/tickets/SeatMap.svelte';
	import SeatViewToggle from '$lib/components/tickets/SeatViewToggle.svelte';
	import {
		defaultSeatViewMode,
		readSeatViewPref,
		standingCountsFrom,
		writeSeatViewPref,
		type SeatViewMode
	} from '$lib/components/tickets/seat-view-toggle';
	import { SeatHoldController } from '$lib/components/tickets/seat-hold-controller.svelte';
	import { holdConflictMessage } from '$lib/components/tickets/purchase-error';
	import {
		estimatedSeatTotal,
		priceLegendEntries,
		unavailableCategoryIds
	} from '$lib/components/tickets/seat-pricing';
	import { buildSeatViews } from '$lib/components/tickets/seating-view';
	import type { TierSeatPricingSchema, VenueChartSchema } from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { formatMoney } from '$lib/utils/format';

	interface Props {
		isUserChoiceSeat: boolean;
		isBestAvailableSeat: boolean;
		/**
		 * Online-payment tiers reserve immediately, so best_available holds a block
		 * at confirm time. Free/offline tiers finalize later via the email-confirm
		 * flow — a 10-minute hold would expire before then, so the server assigns
		 * seats at confirmation instead (notice shown). The accessible-seating
		 * checkbox is shown for BOTH: email flows carry the opt-in in the token.
		 */
		isOnlinePayment: boolean;
		tierVenue: { name: string } | null;
		tierSector: { id?: string | null; name: string } | null;
		tierSectorDescription: string | undefined;
		eventId: string;
		quantity: number;
		isSubmitting: boolean;
		/** Parent validation error ("select N more seats"). */
		seatSelectionError: string;
		/** Parent-set failure message for a best-available hold at confirm. */
		bestAvailableError: string;
		accessibleRequired: boolean;
		onAccessibleRequiredChange: (value: boolean) => void;
		/** Hands the seat-hold controller up to the dialog (submit/close lifecycle). */
		onController: (controller: SeatHoldController) => void;
		/** Server-resolved per-category prices (user_choice tiers, #668). */
		seatPricing?: TierSeatPricingSchema | null;
		/** Tier currency for price display (seat_pricing carries bare decimals). */
		currency?: string | null;
	}

	const {
		isUserChoiceSeat,
		isBestAvailableSeat,
		isOnlinePayment,
		tierVenue,
		tierSector,
		tierSectorDescription,
		eventId,
		quantity,
		isSubmitting,
		seatSelectionError,
		bestAvailableError,
		accessibleRequired,
		onAccessibleRequiredChange,
		onController,
		seatPricing = null,
		currency = null
	}: Props = $props();

	// Best-available tiers only hold seats when the purchase reserves immediately.
	const holdsAtCheckout = $derived(isBestAvailableSeat && isOnlinePayment);

	// Inline 409-conflict message (a seat was grabbed between render and tap)
	let conflictMessage = $state('');
	// Focus target for the conflict alert: the seat button the user pressed
	// becomes disabled when the failed hold resolves, which would silently drop
	// keyboard focus to <body> (WCAG 2.4.3) — so we move it to the alert.
	let conflictAlertEl = $state<HTMLDivElement>();

	// This component only mounts while the dialog is open with a seated tier
	// (bits-ui unmounts DialogContent when closed), so instantiating here scopes
	// the queries and holds to the open dialog. createQuery requires
	// component-init context; mode/payment flags are fixed per dialog instance.
	const controller =
		isUserChoiceSeat || (isBestAvailableSeat && isOnlinePayment)
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

{#if isUserChoiceSeat || isBestAvailableSeat}
	<div class="space-y-3">
		<!-- Venue/Sector Info -->
		{#if tierVenue || tierSector}
			<div class="rounded-lg border border-border bg-muted/30 p-3">
				<div class="flex items-start gap-2 text-sm text-muted-foreground">
					<MapPin class="h-4 w-4 shrink-0" aria-hidden="true" />
					<div class="space-y-0.5">
						{#if tierVenue}
							<div class="font-medium text-foreground">{tierVenue.name}</div>
						{/if}
						{#if tierSector}
							<div>
								{tierSector.name}
								{#if tierSectorDescription}
									<span class="text-xs">({tierSectorDescription})</span>
								{/if}
							</div>
						{/if}
					</div>
				</div>
			</div>
		{/if}

		{#if isUserChoiceSeat}
			<!-- Seat selection UI: selection state IS the server hold -->
			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<span class="text-sm font-medium leading-none"
						>{m['guestTicketDialog.selectYourSeat']()}</span
					>
					{#if quantity > 1}
						<span aria-live="polite" class="text-sm text-muted-foreground">
							{m['guestTicketDialog.selectedSeats']({ selected: heldCount, total: quantity })}
						</span>
					{/if}
				</div>
				{#if isLoadingSeats}
					<div role="status" class="flex items-center justify-center py-12">
						<Loader2 class="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
						<span class="sr-only">
							{m['ticketConfirmationDialog.loadingSeats']()}
						</span>
					</div>
				{:else if seatLoadFailed}
					<Alert variant="destructive">
						<AlertCircle class="h-4 w-4" />
						<AlertDescription>{m['guestTicketDialog.failedToLoadSeats']()}</AlertDescription>
					</Alert>
				{:else if seatViews.length === 0}
					<Alert>
						<AlertCircle class="h-4 w-4" />
						<AlertDescription>{m['guestTicketDialog.noSeatsAvailable']()}</AlertDescription>
					</Alert>
				{:else}
					<!-- Map/List toggle sits OUTSIDE the map surface (touch-action:
					     none there), so the dialog stays scrollable from this row. -->
					<div class="flex justify-end">
						<SeatViewToggle mode={seatViewMode} onModeChange={handleViewModeChange} />
					</div>
					{#if showPriceLegend}
						<!-- Price legend: color always paired with name/price text (#668). -->
						<ul
							class="flex flex-wrap gap-x-4 gap-y-1 text-xs"
							aria-label={m['seatPricing.legend']()}
						>
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
								disabled={isSubmitting}
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
						<SeatSelector
							seats={seatViews}
							onToggle={handleToggle}
							maxReached={heldCount >= quantity}
							disabled={isSubmitting}
							{seatPricing}
							{currency}
						/>
					{/if}
					{#if estimatedTotal !== null}
						<!-- Estimate only: the charged amount is computed at checkout under
						     the tier lock (holds never lock a price, #668). -->
						<p aria-live="polite" class="text-right text-sm font-medium">
							{m['seatPricing.selectedSeatsTotal']({
								total: formatMoney(estimatedTotal, currency)
							})}
						</p>
					{/if}
				{/if}
				<!-- 409 conflict + validation errors (polite live region) -->
				<div aria-live="polite">
					{#if conflictMessage}
						<div bind:this={conflictAlertEl} tabindex="-1" class="focus:outline-none">
							<Alert variant="destructive">
								<AlertCircle class="h-4 w-4" />
								<AlertDescription>{conflictMessage}</AlertDescription>
							</Alert>
						</div>
					{/if}
					{#if seatSelectionError}
						<p class="text-sm text-destructive">
							{seatSelectionError}
						</p>
					{/if}
				</div>
			</div>
		{:else}
			<!-- best_available: online payment holds a block at checkout; the
			     email-confirm flow assigns seats server-side at confirmation (a
			     10-minute hold would expire before the email is opened). The
			     accessible-seating opt-in applies to BOTH — email flows embed it in
			     the confirmation token and assign from the accessible pool. -->
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
						<div class="mt-3 flex items-center gap-2">
							<Checkbox
								id="guest-accessible-seats-required"
								checked={accessibleRequired}
								onCheckedChange={(checked) => onAccessibleRequiredChange(checked === true)}
								disabled={isSubmitting}
							/>
							<Label
								for="guest-accessible-seats-required"
								class="cursor-pointer text-sm font-normal"
							>
								{m['ticketConfirmationDialog.accessibleSeatsLabel']()}
							</Label>
						</div>
					</div>
				</div>
			</div>
			{#if !holdsAtCheckout}
				<Alert>
					<Info class="h-4 w-4" />
					<AlertDescription>
						{m['guestTicketDialog.bestAvailableEmailNotice']()}
					</AlertDescription>
				</Alert>
			{/if}
			<div aria-live="polite">
				{#if bestAvailableError}
					<Alert variant="destructive">
						<AlertCircle class="h-4 w-4" />
						<AlertDescription>{bestAvailableError}</AlertDescription>
					</Alert>
				{/if}
			</div>
		{/if}
	</div>
{/if}
