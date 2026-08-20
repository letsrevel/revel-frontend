<script lang="ts">
	import { Label } from '$lib/components/ui/label';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { Armchair, AlertCircle, DoorOpen } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { TierSeatPricingSchema, VenueChartSchema } from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { formatMoney } from '$lib/utils/format';
	import { SeatHoldController } from './seat-hold-controller.svelte';
	import { zoneOptions } from './seat-zones';
	import SeatPickerPanel from './SeatPickerPanel.svelte';
	import type { TierSchemaWithId } from '$lib/types/tickets';

	interface Props {
		isUserChoiceSeat: boolean;
		isBestAvailable: boolean;
		tierVenue: { name: string } | null;
		tierSector: { id?: string | null; name: string } | null;
		eventId: string;
		quantity: number;
		/** Hard purchase ceiling — seat taps grow the counter up to this. */
		maxQuantity: number;
		/** Taps drive the counter: raise the dialog's quantity to `next`. */
		onQuantityAutoGrow: (next: number) => void;
		isProcessing: boolean;
		/** Parent validation error ("select N more seats"). */
		seatSelectionError: string;
		/** Parent-set failure message for a best-available hold. */
		bestAvailableError: string;
		accessibleRequired: boolean;
		onAccessibleRequiredChange: (value: boolean) => void;
		/** Buyer's chosen zone on a MAPPED best-available tier (mandatory there). */
		selectedZoneId?: string | null;
		onZoneChange?: (zoneId: string | null) => void;
		/** All tiers of the event: other sold sectors become switch targets in
		 * whole-venue scope (clicking one prompts a section+tier switch). */
		allTiers?: TierSchemaWithId[] | null;
		tierRemainingTickets?: import('$lib/api/generated/types.gen').TierRemainingTicketsSchema[];
		/** Buyer confirmed the switch prompt: swap to this tier's dialog. */
		onSwitchTier?: (tier: TierSchemaWithId) => void;
		/** Dialog opened via a section switch: scroll the seating UI into view
		 * once it renders — the keyed remount resets the dialog's scroll to the
		 * top, hiding the sector the buyer just picked. */
		focusSeating?: boolean;
		/** Hands the seat-hold controller up to the dialog (confirm/close lifecycle). */
		onController: (controller: SeatHoldController) => void;
		/** Server-resolved zone→price legend (category-priced tiers, either mode). */
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
		maxQuantity,
		onQuantityAutoGrow,
		isProcessing,
		seatSelectionError,
		bestAvailableError,
		accessibleRequired,
		onAccessibleRequiredChange,
		selectedZoneId = null,
		onZoneChange = undefined,
		allTiers = null,
		tierRemainingTickets = undefined,
		onSwitchTier = undefined,
		focusSeating = false,
		onController,
		seatPricing = null,
		currency = null
	}: Props = $props();

	// Ref to the extracted seat-picking panel: the controller's onConflict
	// callback (below) is wired at construction, before the panel exists to
	// take a prop, so the conflict message is reported imperatively — mirrors
	// DiscountCodeInput's `resetInput` bind:this pattern.
	let panelRef: SeatPickerPanel | undefined = $state();

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
					getMaxQuantity: () => maxQuantity,
					onAutoGrowQuantity: onQuantityAutoGrow,
					isAuthenticated: () => !!authStore.accessToken,
					onConflict: (_seatIds, reason) => {
						panelRef?.reportConflict(reason);
					}
				})
			: null;

	$effect(() => {
		if (controller) onController(controller);
	});

	const chart = $derived(controller?.chartQuery.data ?? null);
	const availability = $derived(controller?.availabilityQuery.data ?? null);

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
		if (!controller || !isUserChoiceSeat || !chart || !availability) return;
		if (!seeded) {
			seeded = true;
			controller.seedFromAvailability(collectValidSeatIds(chart));
			return;
		}
		// The seed snapshot can predate a hold the caller already placed (handed
		// off from the overview map mid-refetch). Adopt what later payloads
		// reveal, or the buyer's own seat stays "held by someone else" forever.
		controller.adoptServerHolds();
	});

	// --- zone picker (mapped best-available tiers) ---------------------------
	// The options are the tier's sellable zones (seat_pricing.categories);
	// selectability compares the per-zone availability snapshot against the
	// requested quantity (exact predicate — see seat-zones.ts). Until the
	// snapshot loads every zone stays selectable; the server is the authority.
	const zoneOpts = $derived(
		isBestAvailable
			? zoneOptions(
					seatPricing,
					availability ? (availability.zones ?? null) : null,
					tierSector?.id ?? null,
					quantity,
					accessibleRequired
				)
			: []
	);

	// Single-zone convenience: preselect the only zone (the REQUEST still names
	// it explicitly — the backend has no default). A selection whose zone
	// disappeared (tier refetch) is cleared rather than silently submitted.
	$effect(() => {
		if (zoneOpts.length === 0) return;
		if (selectedZoneId && !zoneOpts.some((zone) => zone.id === selectedZoneId)) {
			onZoneChange?.(null);
			return;
		}
		if (!selectedZoneId && zoneOpts.length === 1 && zoneOpts[0].selectable) {
			onZoneChange?.(zoneOpts[0].id);
		}
	});
</script>

{#if isUserChoiceSeat && controller}
	<!-- Extracted panel (#853 PR 3): map+list views, floor/scope/view toggles,
	     price legend, and the conflict live region — see SeatPickerPanel for
	     the full implementation. The cart flow's SeatPickerDialog renders the
	     SAME component over its own transient controller. -->
	<SeatPickerPanel
		bind:this={panelRef}
		{controller}
		{tierVenue}
		{tierSector}
		{quantity}
		{maxQuantity}
		{isProcessing}
		{seatSelectionError}
		{allTiers}
		{tierRemainingTickets}
		{onSwitchTier}
		{focusSeating}
		{seatPricing}
		{currency}
	/>
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
				{#if zoneOpts.length > 0}
					<!-- Mapped tier: the buyer names a zone; seats are auto-assigned
					     within it. Mandatory — the backend deliberately has no default,
					     so the picker renders even for a single-zone tier. -->
					<fieldset class="mt-3">
						<legend class="text-sm font-medium">{m['seatZones.legend']()}</legend>
						<p class="mt-0.5 text-xs text-muted-foreground">{m['seatZones.help']()}</p>
						<div class="mt-2 space-y-1.5">
							{#each zoneOpts as zone (zone.id)}
								<label
									class="flex cursor-pointer items-center gap-2.5 rounded-md border p-2.5 text-sm transition-colors {selectedZoneId ===
									zone.id
										? 'border-primary bg-primary/5'
										: 'border-border'} {!zone.selectable ? 'cursor-not-allowed opacity-60' : ''}"
								>
									<input
										type="radio"
										name="seat-zone"
										value={zone.id}
										checked={selectedZoneId === zone.id}
										onchange={() => onZoneChange?.(zone.id)}
										disabled={isProcessing || !zone.selectable}
										class="h-4 w-4 accent-primary"
									/>
									<span
										class="inline-block h-3 w-3 shrink-0 rounded-full border-2 bg-background"
										style={zone.color ? `border-color: ${zone.color}` : undefined}
										aria-hidden="true"
									></span>
									<span class="min-w-0 flex-1 truncate">{zone.name}</span>
									{#if !zone.selectable}
										<span class="shrink-0 text-xs text-muted-foreground">
											{zone.freeSeats === 0
												? m['seatZones.soldOut']()
												: m['seatZones.notEnough']({ count: quantity })}
										</span>
									{/if}
									{#if zone.price != null}
										<span class="shrink-0 font-medium">{formatMoney(zone.price, currency)}</span>
									{/if}
								</label>
							{/each}
						</div>
					</fieldset>
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
