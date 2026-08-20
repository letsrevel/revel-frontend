<script lang="ts">
	/**
	 * The `user_choice` seat-picking UI (#853 PR 3 extraction): map/list views,
	 * floor/scope/view toggles, price legend, the 409-conflict live region, and
	 * cross-sector switching. Extracted verbatim from `SeatAssignmentSection`'s
	 * `user_choice` branch so there is ONE implementation — `SeatAssignmentSection`
	 * (legacy single-tier dialog) and `SeatPickerDialog` (cart flow) both render
	 * this panel over their own already-constructed `SeatHoldController`.
	 *
	 * Deliberately does NOT construct the controller or seed/adopt server holds —
	 * both hosts have different lifecycles for that (a dialog-scoped controller
	 * vs. a cart-lifetime one), so seeding stays their responsibility. This panel
	 * is a pure view over whatever holds the controller already has.
	 *
	 * The 409-conflict message is exposed imperatively via `reportConflict` (call
	 * through a `bind:this` ref) rather than a prop, because the host wires the
	 * controller's `onConflict` callback at construction time — before this panel
	 * exists to receive props — mirroring `DiscountCodeInput`'s `resetInput`.
	 */
	import { tick } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { Armchair, Loader2, AlertCircle } from '@lucide/svelte';
	import type {
		TierRemainingTicketsSchema,
		TierSeatPricingSchema
	} from '$lib/api/generated/types.gen';
	import { formatMoney } from '$lib/utils/format';
	import type { SeatHoldController, HoldConflictReason } from './seat-hold-controller.svelte';
	import { holdConflictMessage } from './purchase-error';
	import { estimatedSeatTotal, priceLegendEntries, sellableCategoryIds } from './seat-pricing';
	import SeatSectorSwitchDialog from './SeatSectorSwitchDialog.svelte';
	import {
		buildSectorOverview,
		switchTargetsFor,
		type SectorOverviewEntry
	} from '$lib/components/events/venue-overview';
	import type { TierSchemaWithId } from '$lib/types/tickets';
	import { buildSeatViews } from './seating-view';
	import SeatSelector from './SeatSelector.svelte';
	import FloorSwitcher from './FloorSwitcher.svelte';
	import SeatMap from './SeatMap.svelte';
	import SeatViewToggle from './SeatViewToggle.svelte';
	import SeatScopeToggle from './SeatScopeToggle.svelte';
	import {
		filterChartToFloor,
		parseFloors,
		sectorFloorId
	} from '$lib/components/venues/venue-floors';
	import {
		defaultSeatViewMode,
		readSeatMapScopePref,
		readSeatViewPref,
		standingCountsFrom,
		writeSeatMapScopePref,
		writeSeatViewPref,
		type SeatMapScope,
		type SeatViewMode
	} from './seat-view-toggle';

	interface Props {
		controller: SeatHoldController;
		tierVenue: { name: string } | null;
		tierSector: { id?: string | null; name: string } | null;
		quantity: number;
		/** Hard purchase ceiling — seat taps grow the counter up to this. */
		maxQuantity: number;
		isProcessing: boolean;
		/** Parent validation error ("select N more seats"). */
		seatSelectionError: string;
		/** All tiers of the event: other sold sectors become switch targets in
		 * whole-venue scope (clicking one prompts a section+tier switch). */
		allTiers?: TierSchemaWithId[] | null;
		tierRemainingTickets?: TierRemainingTicketsSchema[];
		/** Buyer confirmed the switch prompt: swap to this tier's dialog/group. */
		onSwitchTier?: (tier: TierSchemaWithId) => void;
		/** Dialog opened via a section switch: scroll the seating UI into view
		 * once it renders — the keyed remount resets scroll to the top, hiding
		 * the sector the buyer just picked. */
		focusSeating?: boolean;
		/** Server-resolved zone→price legend (category-priced tiers). */
		seatPricing?: TierSeatPricingSchema | null;
		/** Tier currency for price display (seat_pricing carries bare decimals). */
		currency?: string | null;
	}

	const {
		controller,
		tierVenue,
		tierSector,
		quantity,
		maxQuantity,
		isProcessing,
		seatSelectionError,
		allTiers = null,
		tierRemainingTickets = undefined,
		onSwitchTier = undefined,
		focusSeating = false,
		seatPricing = null,
		currency = null
	}: Props = $props();

	// Inline 409-conflict message (a seat was grabbed between render and tap)
	let conflictMessage = $state('');
	// Focus target for the conflict alert: the seat button the user pressed
	// becomes disabled when the failed hold resolves, which would silently drop
	// keyboard focus to <body> (WCAG 2.4.3) — so we move it to the alert.
	let conflictAlertEl = $state<HTMLDivElement>();

	/** Called by the host's controller `onConflict` callback (wired at
	 * construction, before this panel exists to take a prop). */
	export function reportConflict(reason: HoldConflictReason): void {
		conflictMessage = holdConflictMessage(reason);
		void tick().then(() => conflictAlertEl?.focus());
	}

	const chart = $derived(controller.chartQuery.data ?? null);
	const availability = $derived(controller.availabilityQuery.data ?? null);
	const isLoadingSeats = $derived(
		controller.chartQuery.isPending || controller.availabilityQuery.isPending
	);
	const seatLoadFailed = $derived(
		controller.chartQuery.isError || controller.availabilityQuery.isError
	);

	// ALLOW-list of categories this tier sells (null = flat tier): painted
	// seats outside it render blocked — including categories painted after the
	// tier payload was fetched — checkout would refuse them with a 400.
	const sellableIds = $derived(sellableCategoryIds(seatPricing));

	const seatViews = $derived.by(() => {
		if (!chart || !availability) return [];
		return buildSeatViews(chart, availability, {
			sectorId: tierSector?.id ?? null,
			myHolds: controller.myHolds,
			pending: controller.pendingSeatIds,
			sellableCategoryIds: sellableIds
		});
	});

	// Map scope: the tier's own section (default, readable seat sizes) or the
	// whole venue for spatial context — the tier's sector stays interactive,
	// every other sector renders as an inert ghost (activeSectorId below), so
	// out-of-scope seats never masquerade as crossed-out "unavailable".
	let mapScope = $state<SeatMapScope>(readSeatMapScopePref() ?? 'section');
	const canShowVenueScope = $derived((chart?.sectors?.length ?? 0) > 1 && !!tierSector?.id);
	const effectiveScope = $derived(canShowVenueScope && mapScope === 'venue' ? 'venue' : 'section');

	function handleScopeChange(scope: SeatMapScope): void {
		mapScope = scope;
		writeSeatMapScopePref(scope);
	}

	// Multi-floor venues (#680): whole-venue scope renders ONE floor at a time
	// (chips in the toggle row), defaulting to the floor the TIER's sector
	// lives on. Filtering touches only the chart handed to SeatMap — holds,
	// switch targets and seat views stay computed on the full chart, so a
	// floor switch never releases a held seat.
	const floorList = $derived(chart ? parseFloors(chart.metadata) : []);
	const tierFloorId = $derived.by(() => {
		if (!chart || floorList.length === 0 || !tierSector?.id) return null;
		const sector = (chart.sectors ?? []).find((candidate) => candidate.id === tierSector.id);
		return sector ? sectorFloorId(sector.metadata, floorList) : null;
	});
	let pickedFloorId = $state<string | null>(null);
	const activeFloorId = $derived(
		pickedFloorId && floorList.some((floor) => floor.id === pickedFloorId)
			? pickedFloorId
			: (tierFloorId ?? floorList[0]?.id ?? null)
	);
	// The stage belongs to the FIRST (ground) floor by convention (it has no
	// floor field), so other floors hide even the fallback pill.
	const hideStage = $derived(
		effectiveScope === 'venue' && floorList.length > 1 && activeFloorId !== floorList[0].id
	);

	// Section scope filters the chart to the tier's sector; venue scope hands
	// SeatMap the full chart (floor-filtered on multi-floor venues) plus the
	// active sector for ghost rendering.
	const mapChart = $derived.by(() => {
		if (!chart || !tierSector?.id) return chart;
		if (effectiveScope === 'venue') {
			return floorList.length > 1 ? filterChartToFloor(chart, floorList, activeFloorId) : chart;
		}
		return { ...chart, sectors: (chart.sectors ?? []).filter((s) => s.id === tierSector.id) };
	});

	// Whole-venue scope with the event's tier list available: other SOLD
	// sectors become labelled click targets — clicking one prompts a
	// section+tier switch (never a silent swap; held seats are named in the
	// prompt). Without the tier list the old inert-ghost rendering applies.
	const sectorEntries = $derived(
		effectiveScope === 'venue' && chart && allTiers && onSwitchTier
			? buildSectorOverview(chart, allTiers, { remaining: tierRemainingTickets })
			: []
	);
	const switchTargets = $derived.by(() => {
		if (sectorEntries.length === 0) return null;
		const targets = switchTargetsFor(sectorEntries, tierSector?.id);
		return targets.length > 0 ? targets : null;
	});
	let switchEntry = $state<SectorOverviewEntry | null>(null);

	function handleSectorTarget(sectorId: string): void {
		switchEntry = sectorEntries.find((entry) => entry.sectorId === sectorId) ?? null;
	}

	const heldCount = $derived(controller.myHolds.length);

	// After a section switch the dialog remounts scrolled to the top; once the
	// seat UI has actually rendered, bring it into view so the buyer lands on
	// the sector they just picked instead of the tier header.
	let seatingRootEl = $state<HTMLDivElement>();
	let focusSeatingDone = false;
	$effect(() => {
		if (!focusSeating || focusSeatingDone || !seatingRootEl) return;
		if (isLoadingSeats || seatViews.length === 0) return;
		focusSeatingDone = true;
		const el = seatingRootEl;
		// The dialog is still mounting/animating when this first passes, and
		// bits-ui's open autofocus scrolls the content back to the top — so a
		// single post-tick scroll gets undone. Re-assert across the opening
		// frames instead; the loop is short and idempotent, and the last
		// assert (after the dialog settles) wins.
		const started = performance.now();
		const assertScroll = () => {
			el.scrollIntoView({ block: 'start' });
			if (performance.now() - started < 400) requestAnimationFrame(assertScroll);
		};
		requestAnimationFrame(assertScroll);
	});

	function handleToggle(seatId: string): void {
		conflictMessage = '';
		void controller.toggleSeat(seatId);
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
	const estimatedTotal = $derived(estimatedSeatTotal(seatPricing, chart, controller.myHolds));
</script>

<!-- Seat Selection UI for user_choice mode (selection = server hold) -->
<div bind:this={seatingRootEl} class="space-y-3">
	<!-- Section header at celebration volume: the seat step is the emotional
	     peak of the purchase, so it gets display type and a counter chip
	     instead of two lines of 14px grey. Copy is unchanged. -->
	<div class="flex flex-wrap items-center justify-between gap-2">
		<span class="flex items-center gap-2 text-xl font-extrabold leading-none">
			<Armchair class="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
			{m['ticketConfirmationDialog.selectSeats']()}
		</span>
		<span
			aria-live="polite"
			class="rounded-full border-2 border-primary/40 bg-card px-3 py-1 text-sm font-extrabold text-primary"
		>
			{heldCount} / {quantity}
			{m['ticketConfirmationDialog.seatsSelected']()}
		</span>
	</div>

	{#if tierVenue || tierSector}
		<p class="text-sm font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
			{#if tierVenue}
				<span>{tierVenue.name}</span>
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
		<div class="flex flex-wrap items-center justify-end gap-2">
			{#if seatViewMode === 'map' && effectiveScope === 'venue' && floorList.length > 1}
				<FloorSwitcher
					floors={floorList}
					{activeFloorId}
					onFloorChange={(floorId) => (pickedFloorId = floorId)}
				/>
			{/if}
			{#if seatViewMode === 'map' && canShowVenueScope}
				<SeatScopeToggle scope={effectiveScope} onScopeChange={handleScopeChange} />
			{/if}
			<SeatViewToggle mode={seatViewMode} onModeChange={handleViewModeChange} />
		</div>
		{#if showPriceLegend}
			<!-- Price legend: color always paired with name/price text (#668).
			     Swatches mirror the map's category ring on an available seat. -->
			<!-- Solid chips, like the mock's zone legend. The SWATCH stays a
			     ring-style disc — colour on the stroke, surface in the middle —
			     because that is exactly how SeatMap draws an available seat
			     (`fill-background` + `stroke={category.color}`); a solid disc
			     here would stop mirroring the thing it explains. The chip's own
			     2px border is what guarantees a boundary on the card, so a
			     category painted near-white or near-black still reads as an
			     entry even when its stroke does not. -->
			<ul class="flex flex-wrap gap-1.5 text-xs" aria-label={m['seatPricing.legend']()}>
				{#each legendEntries as entry (entry.id ?? 'unpainted')}
					<li
						class="inline-flex items-center gap-1.5 rounded-full border-2 border-border bg-card px-2.5 py-1"
					>
						<span
							class="inline-block h-3 w-3 shrink-0 rounded-full border-2 bg-background"
							style={entry.color ? `border-color: ${entry.color}` : undefined}
							class:border-border={!entry.color}
							aria-hidden="true"
						></span>
						<span class="font-bold">
							{entry.name ?? m['seatPricing.standardSeats']()}
						</span>
						{#if entry.available && entry.price != null}
							<span class="font-extrabold text-primary">{formatMoney(entry.price, currency)}</span>
						{:else}
							<span class="text-muted-foreground">{m['seatPricing.notAvailable']()}</span>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
		{#if seatViewMode === 'map' && mapChart}
			<!-- Tall map surface (the seated dialog widens for it); pan/zoom
			     reaches anything beyond the box.
			     The scoped-`dark` trick this frame used to carry is GONE (#852):
			     SeatMap now paints its own poster-ink house with fixed poster
			     values, so the theatre no longer depends on borrowing dark-mode
			     tokens, and every seat state is hand-verified against ink
			     instead of against whatever `--background` resolved to. The
			     frame here supplies height, clipping and the float only.
			     `shadow-poster` is theme-aware on purpose: the panel is a
			     picture, but the shadow it casts belongs to the page under it. -->
			<div class="h-[58vh] shrink-0 overflow-hidden rounded-[20px] shadow-poster">
				<SeatMap
					chart={mapChart}
					seats={seatViews}
					onToggle={handleToggle}
					maxReached={heldCount >= maxQuantity}
					disabled={isProcessing}
					activeSectorId={effectiveScope === 'venue' && !switchTargets
						? (tierSector?.id ?? null)
						: null}
					sectorTargets={switchTargets}
					interactiveSectors={switchTargets && tierSector?.id
						? [
								{
									sectorId: tierSector.id,
									seatPricing: seatPricing ?? null,
									currency: currency ?? null,
									maxReached: heldCount >= maxQuantity
								}
							]
						: null}
					onSectorSelect={handleSectorTarget}
					{standingCounts}
					{seatPricing}
					{currency}
					{hideStage}
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
			     hold notice and legend stay visible). No frame here any more:
			     SeatSelector now brings its own ink stage panel. -->
			<div>
				<SeatSelector
					seats={seatViews}
					onToggle={handleToggle}
					maxReached={heldCount >= maxQuantity}
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

<SeatSectorSwitchDialog
	entry={switchEntry}
	heldCount={controller.myHolds.length}
	onPick={(tier) => {
		switchEntry = null;
		// Cross-sector switch releases only THIS controller's own holds — never
		// releaseAll, which would nuke every other seated group's holds too
		// when several groups share the same identity+event (cart flow, #853).
		void controller.release(controller.myHolds);
		onSwitchTier?.(tier);
	}}
	onCancel={() => (switchEntry = null)}
/>
