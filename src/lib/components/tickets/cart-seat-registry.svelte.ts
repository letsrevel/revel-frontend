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
 * side effects — just storage plus the one cross-cutting derived value
 * (the countdown needs SOME controller's availability data, and any
 * registered one will do since they all share the
 * `['seating-availability', eventId]` query-cache entry).
 */
import { SvelteMap } from 'svelte/reactivity';
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
}
