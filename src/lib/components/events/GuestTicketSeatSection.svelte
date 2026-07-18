<script lang="ts">
	import { tick } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { Label } from '$lib/components/ui/label';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { AlertCircle, Loader2, MapPin, Info, Armchair } from '@lucide/svelte';
	import SeatSelector from '$lib/components/tickets/SeatSelector.svelte';
	import { SeatHoldController } from '$lib/components/tickets/seat-hold-controller.svelte';
	import { holdConflictMessage } from '$lib/components/tickets/purchase-error';
	import { buildSeatViews } from '$lib/components/tickets/seating-view';
	import type { VenueChartSchema } from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';

	interface Props {
		isUserChoiceSeat: boolean;
		isBestAvailableSeat: boolean;
		/**
		 * Online-payment tiers reserve immediately, so best_available holds a block
		 * at confirm time (checkbox shown). Free/offline tiers finalize later via
		 * the email-confirm flow — a 10-minute hold would expire before then, so
		 * the server assigns seats at confirmation instead (notice shown).
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
		onController
	}: Props = $props();

	// Best-available tiers only hold seats when the purchase reserves immediately.
	const holdsAtCheckout = $derived(isBestAvailableSeat && isOnlinePayment);

	// Inline 409-conflict message (a seat was grabbed between render and tap)
	let conflictMessage = $state('');
	// Focus target for the conflict alert: the seat button the user pressed
	// becomes disabled when the failed hold resolves, which would silently drop
	// keyboard focus to <body> (WCAG 2.4.3) — so we move it to the alert.
	let conflictAlertEl: HTMLDivElement | undefined;

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
							{m['ticketConfirmationDialog.loadingSeats']?.() ?? 'Loading available seats...'}
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
					<SeatSelector
						seats={seatViews}
						onToggle={handleToggle}
						maxReached={heldCount >= quantity}
						disabled={isSubmitting}
					/>
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
		{:else if holdsAtCheckout}
			<!-- best_available + online payment: block is held when checkout starts -->
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
		{:else}
			<!-- best_available + email-confirm flow: no hold (it would expire before
			     the email is opened) — the server assigns seats at confirmation -->
			<Alert>
				<Info class="h-4 w-4" />
				<AlertDescription>
					{m['guestTicketDialog.bestAvailableEmailNotice']?.() ??
						'Your seats will be assigned automatically when you confirm your email.'}
				</AlertDescription>
			</Alert>
		{/if}
	</div>
{/if}
