/**
 * Confirm-time best-available hold step (#853 PR 3). A `best_available` cart
 * group already picked a block earlier (zone selection in the sheet), but
 * that hold can go stale by the time the buyer hits Confirm — zone change,
 * expiry, another tab. This re-holds fresh, right before the checkout POST,
 * for every such group — mirroring `cart-discount.ts`'s DI pattern (an
 * injected `wouldSkip` flag rather than reaching into the checkout controller
 * itself) so the orchestration is unit-testable with fake controllers.
 */
import type { CartGroup } from './cart.svelte';
import type { CartSeatHoldRegistry } from './cart-seat-registry.svelte';
import { bestAvailableFailureMessage } from './purchase-error';

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
