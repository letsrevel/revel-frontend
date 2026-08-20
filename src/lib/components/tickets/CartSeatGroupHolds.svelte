<script lang="ts">
	/**
	 * Cart-lifetime seat-hold owner for ONE seated cart group (#853 PR 3).
	 * Mounted per group by `CartSeatHolds`, keyed on `group.tier.id`. Instantiates
	 * the tier's `SeatHoldController` — must happen at component init, it calls
	 * `createQuery`/`useQueryClient` — and registers it into the page-level
	 * registry so the seat picker dialog, the checkout sheet, and the
	 * confirm-time best-available hold (later tasks) all drive the SAME
	 * controller instead of a second one that doesn't know about the first's
	 * holds.
	 *
	 * `user_choice` groups additionally keep `cart`'s `seatIds` in sync with
	 * the controller's live holds — this effect is the ONLY writer of
	 * `seatIds` besides the host's expiry sweep (`CartSeatHolds`).
	 * `best_available` groups get a controller too (availability/zones for the
	 * sheet, `holdBestAvailable` at confirm time) but never touch `seatIds`
	 * here — best-available seats aren't picked, they're assigned at confirm.
	 */
	import { onDestroy } from 'svelte';
	import type { VenueChartSchema } from '$lib/api/generated/types.gen';
	import type { CartGroup, EventCart } from './cart.svelte';
	import type { CartSeatHoldRegistry } from './cart-seat-registry.svelte';
	import {
		SeatHoldController,
		type SeatHoldControllerOptions
	} from './seat-hold-controller.svelte';
	import { holdConflictMessage } from './purchase-error';
	import { toast } from 'svelte-sonner';

	interface Props {
		cart: EventCart;
		registry: CartSeatHoldRegistry;
		eventId: string;
		group: CartGroup;
	}

	const { cart, registry, eventId, group }: Props = $props();

	// The tier this instance owns is fixed for its lifetime (keyed `#each`
	// remounts on tier change), so capturing it once at init is deliberate.
	// svelte-ignore state_referenced_locally
	const tier = group.tier;
	const isUserChoice = tier.seat_assignment_mode === 'user_choice';

	// Declared ahead of `options` (explicit type annotation) so `getQuantity`
	// can close over it without a circular type-inference error — it's only
	// ever CALLED after the assignment below, never read synchronously.
	let controller: SeatHoldController;

	// The event is fixed for a mounted page instance, so capturing eventId's
	// initial value here is deliberate (mirrors SeatAssignmentSection).
	// svelte-ignore state_referenced_locally
	const options: SeatHoldControllerOptions = {
		eventId,
		// user_choice has no independent stepper (Task 6): the tap-driven
		// controller IS the counter, so feeding it back its own hold count
		// keeps the grow-on-tap check a harmless pass-through instead of
		// fighting the live-sync effect below. best_available keeps the
		// cart's stepper-driven quantity.
		getQuantity: () => (isUserChoice ? controller.myHolds.length : cart.quantityFor(tier.id)),
		getMaxQuantity: () => cart.maxQuantity(tier),
		onAutoGrowQuantity: (next) => {
			// user_choice: the live-sync effect derives quantity from
			// controller.myHolds via cart.setSeatIds — nothing more to do here.
			if (isUserChoice) return;
			cart.setQuantity(tier, next);
		},
		isAuthenticated: () => true, // this host only mounts in the authed block
		onConflict: (_seatIds, reason) => {
			toast.error(holdConflictMessage(reason));
		}
	};

	// Must be constructed during component init (createQuery/useQueryClient).
	controller = new SeatHoldController(options);

	// Registering into the page-level registry is a one-time init step for
	// this instance's fixed tier, not a reactive read of `registry` itself.
	// svelte-ignore state_referenced_locally
	registry.set(tier.id, controller);

	onDestroy(() => {
		registry.delete(tier.id);
		// Tickets now own the seats — releasing them would hand them back.
		if (registry.handedOffToCheckout) return;
		if (controller.myHolds.length === 0) return;
		void controller.release(controller.myHolds);
	});

	/** Active seat ids in this tier's sector (mirrors SeatAssignmentSection's
	 * collectValidSeatIds — all seated sectors when the tier has none). */
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

	// Adopt the caller's server-side holds once chart + availability are
	// loaded. The venue-overview map (or an earlier picker session on this
	// same registered controller) can have placed holds server-side before
	// THIS controller instance's availability query has resolved them — the
	// first pass seeds from the snapshot, later passes adopt anything that
	// landed after (adoptServerHolds' own docstring covers this hand-off).
	let seeded = false;
	$effect(() => {
		if (!isUserChoice) return;
		const chart = controller.chartQuery.data;
		const availability = controller.availabilityQuery.data;
		if (!chart || !availability) return;
		if (!seeded) {
			seeded = true;
			controller.seedFromAvailability(validSeatIdsFor(chart));
			return;
		}
		controller.adoptServerHolds();
	});

	// Live sync: the controller's held seats ARE the group's seatIds. The
	// ONLY other writer is the host's expiry sweep (which clears to []).
	$effect(() => {
		if (!isUserChoice) return;
		cart.setSeatIds(tier, controller.myHolds);
	});
</script>
