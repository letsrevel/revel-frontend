<script lang="ts">
	import { tick } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { Label } from '$lib/components/ui/label';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { Armchair, Loader2, AlertCircle, DoorOpen } from '@lucide/svelte';
	import type { VenueChartSchema } from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { SeatHoldController } from './seat-hold-controller.svelte';
	import { holdConflictMessage } from './purchase-error';
	import { buildSeatViews } from './seating-view';
	import SeatSelector from './SeatSelector.svelte';

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
		onController
	}: Props = $props();

	// Inline 409-conflict message (a seat was grabbed between render and tap)
	let conflictMessage = $state('');
	// Focus target for the conflict alert: the seat button the user pressed
	// becomes disabled when the failed hold resolves, which would silently drop
	// keyboard focus to <body> (WCAG 2.4.3) — so we move it to the alert.
	let conflictAlertEl: HTMLDivElement | undefined;

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

	const seatViews = $derived.by(() => {
		if (!controller || !chart || !availability) return [];
		return buildSeatViews(chart, availability, {
			sectorId: tierSector?.id ?? null,
			myHolds: controller.myHolds,
			pending: controller.pendingSeatIds
		});
	});

	const heldCount = $derived(controller?.myHolds.length ?? 0);

	function handleToggle(seatId: string): void {
		conflictMessage = '';
		void controller?.toggleSeat(seatId);
	}
</script>

{#if isUserChoiceSeat}
	<!-- Seat Selection UI for user_choice mode (selection = server hold) -->
	<div class="space-y-3">
		<div class="flex items-center justify-between">
			<span class="flex items-center gap-2 text-sm font-medium leading-none">
				<Armchair class="h-4 w-4" />
				{m['ticketConfirmationDialog.selectSeats']?.() ?? 'Select Your Seats'}
			</span>
			<span aria-live="polite" class="text-sm text-muted-foreground">
				{heldCount} / {quantity}
				{m['ticketConfirmationDialog.seatsSelected']?.() ?? 'selected'}
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
					{m['ticketConfirmationDialog.loadingSeats']?.() ?? 'Loading available seats...'}
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
					{m['ticketConfirmationDialog.noSeatsAvailable']?.() ??
						'No seats available for selection.'}
				</AlertDescription>
			</Alert>
		{:else}
			<!-- Seat Selection Grid (SeatSelector caps its own grid height so the
			     hold notice and legend stay visible) -->
			<div class="rounded-lg border border-border bg-background p-3">
				<SeatSelector
					seats={seatViews}
					onToggle={handleToggle}
					maxReached={heldCount >= quantity}
					disabled={isProcessing}
				/>
			</div>
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
					{m['ticketConfirmationDialog.bestAvailableTitle']?.() ?? 'Best available seats'}
				</p>
				<p class="text-sm text-muted-foreground">
					{m['ticketConfirmationDialog.bestAvailableDesc']?.() ??
						'Your seats will be assigned automatically — adjacent seats, best block available.'}
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
						{m['ticketConfirmationDialog.accessibleSeatsLabel']?.() ??
							'I need wheelchair-accessible seats'}
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
					{m['ticketConfirmationDialog.generalEntrance']?.() ?? 'General Entrance'}
				</p>
				<p class="text-sm text-muted-foreground">
					{m['ticketConfirmationDialog.generalEntranceDesc']?.() ??
						'This ticket grants general admission without assigned seating.'}
				</p>
				<p class="mt-2 text-sm font-medium">{tierVenue.name}</p>
			</div>
		</div>
	</div>
{/if}
