<script lang="ts">
	/**
	 * Cart-flow seat picker (#853 PR 3): hosts `SeatPickerPanel` over a
	 * TRANSIENT `SeatHoldController` — instantiated fresh every time this
	 * dialog mounts (the page conditionally renders it, keyed on the tier being
	 * picked), never reused from `registry`.
	 *
	 * The transient controller resolves a chicken-and-egg problem: the cart's
	 * cart-lifetime, per-group controller (owned by `CartSeatGroupHolds`,
	 * registered into `registry`) doesn't exist until the tier's `CartGroup`
	 * does — and the group doesn't exist until seats have been picked. So
	 * picking needs its OWN controller before any group exists.
	 *
	 * On mount, it seeds from the server's `my_holds` exactly like
	 * `CartSeatGroupHolds` does (same query-cache keys — warm caches, instant
	 * data when another controller already fetched them). If the tier ALREADY
	 * has a cart group (editing an existing pick), the same server-side holds
	 * get adopted here too — there's nothing special-cased for that path, the
	 * seed/adopt effect just picks them up.
	 *
	 * Done hands the picked seats to the cart (`cart.setSeatIds`), which either
	 * creates the group (mounting `CartSeatGroupHolds`, which seeds from the
	 * same now-warm caches and adopts the identical server holds) or updates
	 * the existing one in place. `handedOff` then guards the teardown release —
	 * abandoning the dialog WITHOUT hitting Done releases whatever this
	 * transient controller is still holding, so picking-then-closing never
	 * leaks a hold.
	 */
	import { onDestroy } from 'svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogDescription,
		DialogFooter
	} from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { formatMoney } from '$lib/utils/format';
	import type { TierSchemaWithId } from '$lib/types/tickets';
	import type { VenueChartSchema } from '$lib/api/generated/types.gen';
	import type { EventCart } from './cart.svelte';
	import type { CartSeatHoldRegistry } from './cart-seat-registry.svelte';
	import {
		SeatHoldController,
		type SeatHoldControllerOptions
	} from './seat-hold-controller.svelte';
	import { estimatedSeatTotal } from './seat-pricing';
	import SeatPickerPanel from './SeatPickerPanel.svelte';

	interface Props {
		open: boolean;
		tier: TierSchemaWithId;
		eventId: string;
		cart: EventCart;
		registry: CartSeatHoldRegistry;
		/** Hard purchase ceiling for this tier (`cart.maxQuantity(tier)`, read
		 * by the caller — kept fresh across reactive cap changes). */
		maxSeats: number;
	}

	let { open = $bindable(), tier, eventId, cart, registry, maxSeats }: Props = $props();

	let panelRef: SeatPickerPanel | undefined = $state();

	// Set right before the cart takes ownership of the picked seats (Done) so
	// the teardown release below is skipped — the seats now belong to the
	// cart group, not this transient controller.
	let handedOff = false;

	// Captured once, at open time (#853 final-review fix 2): whether this
	// session is EDITING an already-picked tier (a cart group exists) vs. a
	// FIRST pick (no group yet). An edit-session close without Done must not
	// release the group's existing holds — see onDestroy below.
	// svelte-ignore state_referenced_locally
	const wasEditSession = cart.groupFor(tier.id) !== undefined;

	// Declared ahead of `options` (explicit type) so `getQuantity` can close
	// over it without a circular type-inference error — only ever CALLED after
	// the assignment below (mirrors CartSeatGroupHolds). Wrapped in `$state()`
	// (unlike CartSeatGroupHolds' plain `let`, which is renderless and never
	// read from a template/$derived) so the `$derived`s and template below,
	// which DO read `transient` directly, see the reassignment reactively.
	let transient: SeatHoldController = $state() as SeatHoldController;

	// svelte-ignore state_referenced_locally
	const options: SeatHoldControllerOptions = {
		eventId,
		// user_choice has no independent stepper: the tap-driven controller IS
		// the counter (mirrors CartSeatGroupHolds), so feeding it back its own
		// hold count keeps the grow-on-tap check a harmless pass-through.
		getQuantity: () => transient.myHolds.length,
		getMaxQuantity: () => maxSeats,
		onAutoGrowQuantity: () => {
			// Nothing to grow independently — see getQuantity above.
		},
		// Live now (#853 PR 4) rather than hardcoded true: this dialog still only
		// opens from the authed cart flow (Task 5 widens that), but reading the
		// real token here — rather than assuming — is what arms the
		// controller's anonymous-hold sessionStorage bookkeeping once it does.
		isAuthenticated: () => !!authStore.accessToken,
		onConflict: (_seatIds, reason) => {
			panelRef?.reportConflict(reason);
		}
	};
	transient = new SeatHoldController(options);

	/** Active seat ids in this tier's sector (mirrors CartSeatGroupHolds'
	 * validSeatIdsFor / SeatAssignmentSection's collectValidSeatIds). */
	function validSeatIdsFor(chart: VenueChartSchema): Set<string> {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- not reactive state: built fresh per call and consumed synchronously
		const ids = new Set<string>();
		const sectorId = tier.sector?.id ?? null;
		for (const sector of chart.sectors ?? []) {
			if ((sector.kind ?? 'seated') === 'standing') continue;
			if (sectorId && sector.id !== sectorId) continue;
			for (const seat of sector.seats ?? []) {
				if (seat.is_active !== false) ids.add(seat.id);
			}
		}
		return ids;
	}

	let seeded = $state(false);
	$effect(() => {
		const chart = transient.chartQuery.data;
		const availability = transient.availabilityQuery.data;
		if (!chart || !availability) return;
		if (!seeded) {
			seeded = true;
			transient.seedFromAvailability(validSeatIdsFor(chart));
			return;
		}
		transient.adoptServerHolds();
	});

	onDestroy(() => {
		if (handedOff) return;
		if (wasEditSession) {
			// Minimal fix per controller ruling: any close during an EDIT
			// session is treated as Done — releasing here would strip seats
			// out of an existing cart group behind the buyer's back.
			cart.setSeatIds(tier, transient.myHolds);
			return;
		}
		// First-pick session with no group yet: abandoning the dialog releases
		// whatever this transient controller is still holding.
		if (transient.myHolds.length === 0) return;
		void transient.release(transient.myHolds);
	});

	// Whichever registered controller's chart loaded first (shared cache key —
	// see CartSeatHoldRegistry) or, failing that, this dialog's own: avoids an
	// unresolved total flash when another controller already has it warm.
	const chart = $derived(registry.chart ?? transient.chartQuery.data ?? null);
	/** Display estimate — the authoritative amount is computed at checkout. */
	const estimatedTotal = $derived(
		estimatedSeatTotal(tier.seat_pricing ?? null, chart, transient.myHolds)
	);

	function handleDone(): void {
		handedOff = true;
		cart.setSeatIds(tier, transient.myHolds);
		open = false;
	}
</script>

<Dialog bind:open>
	<DialogContent class="flex max-h-[92vh] flex-col sm:max-w-4xl" data-testid="seat-picker-dialog">
		<DialogHeader>
			<DialogTitle class="text-3xl font-black leading-[1.12]">
				{m['cart.pickSeatsTitle']({ tierName: tier.name })}
			</DialogTitle>
			<DialogDescription>{m['cart.pickSeatsDescription']()}</DialogDescription>
		</DialogHeader>

		<div class="min-h-0 flex-1 overflow-y-auto py-2">
			<SeatPickerPanel
				bind:this={panelRef}
				controller={transient}
				tierVenue={tier.venue ?? null}
				tierSector={tier.sector ?? null}
				maxQuantity={maxSeats}
				isProcessing={false}
				seatSelectionError=""
				seatPricing={tier.seat_pricing ?? null}
				currency={tier.currency}
			/>
		</div>

		<DialogFooter class="flex-col gap-2">
			{#if estimatedTotal !== null}
				<p class="flex w-full items-center justify-between border-t border-border pt-2 text-sm">
					<span class="text-muted-foreground">{m['checkoutFooter.total']()}</span>
					<span class="text-base font-bold">{formatMoney(estimatedTotal, tier.currency)}</span>
				</p>
			{/if}
			<div class="flex w-full items-center justify-between gap-3">
				<span aria-live="polite" class="text-sm font-bold">
					{transient.myHolds.length}
					{m['ticketConfirmationDialog.seatsSelected']()}
				</span>
				<Button onclick={handleDone}>{m['cart.seatPickerDone']()}</Button>
			</div>
		</DialogFooter>
	</DialogContent>
</Dialog>
