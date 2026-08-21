/**
 * Page-level registry of cart-lifetime seat-hold controllers (#853 PR 3).
 *
 * `CartSeatGroupHolds` (one per seated cart group) owns the actual
 * `SeatHoldController` instance — it must be constructed during that
 * component's init (it calls `createQuery`/`useQueryClient`) — and registers
 * it here by tier id so sibling UI (the seat picker dialog, the checkout
 * sheet's zone/accessible fields, the confirm-time best-available hold) can
 * reuse the SAME controller instead of standing up a second one that doesn't
 * know about the first's holds. Kept dumb on purpose: no query logic, no
 * side effects — just storage plus two cross-cutting derived values (the
 * countdown needs SOME controller's availability data, and cart totals need
 * SOME controller's chart data; any registered one will do for either, since
 * they all share the `['seating-availability', eventId]` and
 * `['seating-chart', eventId]` query-cache entries respectively — the chart
 * key isn't even sector-scoped, so one controller's chart IS the whole
 * venue's).
 *
 * The registry is the home for `chart` (rather than a prop `CartSeatHolds`
 * exposes) because it's already the one object both `CartSeatHolds` (the
 * writer, via its children's controllers) and the page (the reader, for
 * `cartTotalArgs`/`CheckoutSheet`) hold a reference to — mirroring
 * `expiresAt`, which solves the identical "read from whichever controller
 * has it" problem. Adding a return channel through `CartSeatHolds` itself
 * would mean threading a second prop back up for no benefit.
 */
import { SvelteMap } from 'svelte/reactivity';
import type { VenueChartSchema } from '$lib/api/generated/types.gen';
import type { SeatHoldController } from './seat-hold-controller.svelte';

export class CartSeatHoldRegistry {
	#controllers = new SvelteMap<string, SeatHoldController>();

	/**
	 * Set by the page right before `cart.clear()` on a successful checkout:
	 * the purchased tickets now own the held seats, so `CartSeatGroupHolds`'
	 * destroy handler must NOT release them. Reset back to `false` once the
	 * clear (and the resulting unmounts) have settled.
	 */
	handedOffToCheckout = $state(false);

	get(tierId: string): SeatHoldController | undefined {
		return this.#controllers.get(tierId);
	}

	set(tierId: string, controller: SeatHoldController): void {
		this.#controllers.set(tierId, controller);
	}

	delete(tierId: string): void {
		this.#controllers.delete(tierId);
	}

	/**
	 * Union of `myHolds` across every registered controller EXCEPT
	 * `excludeTierId` (#853 final-review fix 5). A sector can legally be sold
	 * by both a `user_choice` tier and a `best_available` tier — their
	 * controllers share the identity-wide `['seating-availability', eventId]`
	 * cache, so `availability.my_holds` mixes both tiers' holds together. A
	 * `user_choice` group's adopt effect must filter its candidate seat ids
	 * against this set BEFORE seeding, or it will happily claim the
	 * `best_available` group's already-held block as its own.
	 */
	otherHolds(excludeTierId: string): Set<string> {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local lookup set built and consumed synchronously by the caller, never mutated afterwards
		const ids = new Set<string>();
		for (const [tierId, controller] of this.#controllers) {
			if (tierId === excludeTierId) continue;
			for (const id of controller.myHolds) ids.add(id);
		}
		return ids;
	}

	/**
	 * Union of `myHolds` across EVERY registered controller, including the
	 * caller's own tier (#853 PR 4) — unlike `otherHolds`, there's no exclusion
	 * here: this feeds the event page's `protectedSeatIds`, which guards the
	 * venue-overview browse-and-close flow against releasing ANY cart-held
	 * seat. `cart.groups[].seatIds` alone misses `best_available` holds (they
	 * only land in a group's `seatIds` after checkout confirm), so those seats
	 * were unprotected mid-cart — this closes that PR-3-parked residual.
	 */
	allHolds(): string[] {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local dedup set built and consumed synchronously by the caller, never mutated afterwards
		const ids = new Set<string>();
		for (const controller of this.#controllers.values()) {
			for (const id of controller.myHolds) ids.add(id);
		}
		return [...ids];
	}

	/**
	 * Earliest `my_holds_expire_at` across every registered controller's
	 * availability data — event-wide in practice (every controller for this
	 * event shares the same query-cache entry), but computed defensively as a
	 * minimum rather than "the first one found" in case a controller's query
	 * hasn't landed yet while another's has. `null` when nothing is held.
	 */
	readonly expiresAt = $derived.by((): string | null => {
		let earliest: string | null = null;
		for (const controller of this.#controllers.values()) {
			const value = controller.availabilityQuery.data?.my_holds_expire_at;
			if (!value) continue;
			if (earliest === null || Date.parse(value) < Date.parse(earliest)) {
				earliest = value;
			}
		}
		return earliest;
	});

	/**
	 * The venue chart, read from whichever registered controller's
	 * `chartQuery` has data first — every controller for this event shares the
	 * `['seating-chart', eventId]` cache entry (keyed by event only, not by
	 * sector), so any one of them holds the full venue chart. Feeds
	 * `CheckoutTotalArgs.chart`: without it, a `user_choice` group's total is
	 * unresolvable, and `cartTotal` returns `null` (unknown) the moment ANY
	 * group is unknown — so a missing chart silently blanks the WHOLE cart's
	 * total, not just the seated group's.
	 */
	readonly chart = $derived.by((): VenueChartSchema | null => {
		for (const controller of this.#controllers.values()) {
			const data = controller.chartQuery.data;
			if (data) return data;
		}
		return null;
	});
}
