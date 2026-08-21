/**
 * Confirm-time best-available hold step (#853 PR 3). A `best_available` cart
 * group already picked a block earlier (zone selection in the sheet), but
 * that hold can go stale by the time the buyer hits Confirm — zone change,
 * expiry, another tab. This re-holds fresh, right before the checkout POST,
 * for every such group — mirroring `cart-discount.ts`'s DI pattern (an
 * injected `wouldSkip` flag rather than reaching into the checkout controller
 * itself) so the orchestration is unit-testable with fake controllers.
 */
import type { TierSchemaWithId } from '$lib/types/tickets';
import type { CartGroup, EventCart, JoinBlock } from './cart.svelte';
import type { CartSeatHoldRegistry } from './cart-seat-registry.svelte';
import type { CartCheckoutParams } from '../events/cart-checkout-controller.svelte';
import * as m from '$lib/paraglide/messages.js';
import { bestAvailableFailureMessage } from './purchase-error';
import { releaseOrphanedSeatHolds } from './seat-hold-controller.svelte';

export type HoldBestAvailableResult = { ok: true } | { ok: false; tierId: string; message: string };

/**
 * (Re-)holds the best-available block for every `best_available` group in
 * `groups`, sequentially — fine in practice, a cart rarely carries more than
 * one best_available group. For each group:
 *
 *  1. Release that group's OWN current holds first (`controller.myHolds`,
 *     group-scoped — NEVER `releaseAll`, which would also drop sibling
 *     groups' holds sharing the same event-wide hold cap). This clears a
 *     stale block from an earlier zone pick before acquiring the fresh one.
 *  2. Hold a fresh block via `controller.holdBestAvailable`, using the
 *     group's CURRENT `priceCategoryId` — the exact same value
 *     `buildCartItems` puts in the checkout payload, so there is no drift
 *     window between what gets held here and what gets billed.
 *
 * `wouldSkip` (injected by the caller from the checkout controller's
 * `wouldResume(params)`): when true, this is a checkout RESUME rather than a
 * fresh reserve — the held reservation already owns its seat holds from the
 * original reserve call, so re-holding here would just release and
 * reacquire the same block for nothing. All holding is skipped in that case.
 *
 * A `best_available` group with no registered controller is a bug, not a
 * user-facing edge case: `CartSeatGroupHolds` mounts a controller for every
 * such group by construction. Surfaced honestly as a failure rather than
 * silently skipped.
 */
export async function holdBestAvailableGroups(
	groups: CartGroup[],
	registry: CartSeatHoldRegistry,
	wouldSkip: boolean
): Promise<HoldBestAvailableResult> {
	if (wouldSkip) return { ok: true };

	for (const group of groups) {
		const tierId = group.tier.id;
		const controller = registry.get(tierId);
		if (!controller) {
			return {
				ok: false,
				tierId,
				message: bestAvailableFailureMessage({ ok: false, heldSeatIds: [] })
			};
		}

		await controller.release(controller.myHolds);

		const result = await controller.holdBestAvailable(
			tierId,
			group.quantity,
			group.accessibleRequired,
			group.priceCategoryId
		);
		if (!result.ok) {
			return { ok: false, tierId, message: bestAvailableFailureMessage(result) };
		}
	}

	return { ok: true };
}

/**
 * After `cart.setSeatIds` for a venue-overview hand-off, detect and clean up
 * a currency/payment join-block leak (#853 final-review fix 4): the
 * overview already held `heldSeatIds` server-side, but `setSeatIds` no-ops
 * when `joinBlock` refuses to create the group — nothing then owns those
 * holds. Releases them one-shot and returns why, for the caller to toast;
 * `null` when the group was created fine.
 */
export function releaseJoinBlockedHolds(
	cart: EventCart,
	tier: TierSchemaWithId,
	heldSeatIds: string[],
	eventId: string
): JoinBlock {
	if (heldSeatIds.length === 0 || cart.groupFor(tier.id)) return null;
	const block = cart.joinBlock(tier);
	void releaseOrphanedSeatHolds(eventId, heldSeatIds);
	return block;
}

/** User-facing text for a `JoinBlock` reason — shared so `releaseJoinBlockedHolds`
 * callers don't duplicate TierCard.svelte's ternary (left as-is; not this fix's scope). */
export function joinBlockMessage(block: NonNullable<JoinBlock>): string {
	return block === 'currency' ? m['cart.cannotMixCurrency']() : m['cart.cannotMixPayment']();
}

/** The checkout controller surface `submitCart` needs — `createCartCheckoutController`'s return shape. */
export interface CartSubmitController {
	wouldResume: (params: CartCheckoutParams) => boolean;
	checkoutCart: (params: CartCheckoutParams) => Promise<void>;
	readonly isPending: boolean;
}

export interface SubmitCartDeps {
	/** Read live: `cart.bestAvailableGroups` is a `$derived` getter, so a
	 * `SubmitCartDeps` built once at page init stays fresh across calls. */
	cart: EventCart;
	registry: CartSeatHoldRegistry;
	controller: CartSubmitController;
	/** The page's `holdingSeats` guard flag (`controller.isPending` alone
	 * misses the BA-hold round-trip). */
	isHolding: () => boolean;
	setHolding: (value: boolean) => void;
}

export interface SubmitCartHandlers {
	/** A best-available re-hold failed (stale block, sold out, hold-limit hit). */
	onHoldFailure: (message: string) => void;
	/** Any other `checkoutCart` error. Optional: quick-buy relies on the
	 * controller's own error toast instead and just reads the `false` return. */
	onError?: (error: unknown) => void;
}

/**
 * Shared confirm-time submit path (#853 final-review fix 6 — the page's
 * `handleCartBuy` and `handleSheetConfirm` were ~90% duplicated): re-holds
 * every `best_available` group fresh, then submits the checkout. Returns
 * whether checkout completed — the caller decides what to do with that
 * (e.g. close the sheet).
 */
export async function submitCart(
	params: CartCheckoutParams,
	deps: SubmitCartDeps,
	handlers: SubmitCartHandlers
): Promise<boolean> {
	if (deps.isHolding() || deps.controller.isPending) return false;
	deps.setHolding(true);
	try {
		const skip = deps.controller.wouldResume(params);
		const hold = await holdBestAvailableGroups(deps.cart.bestAvailableGroups, deps.registry, skip);
		if (!hold.ok) {
			handlers.onHoldFailure(hold.message);
			return false;
		}
		await deps.controller.checkoutCart(params);
		return true;
	} catch (e) {
		handlers.onError?.(e);
		return false;
	} finally {
		deps.setHolding(false);
	}
}
