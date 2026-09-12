/**
 * Whether `CartSeatGroupHolds` should push `controller.myHolds` into
 * `cart.setSeatIds` right now (#853 PR 3, hardened in #918 and its review).
 *
 * `cart.setSeatIds` REPLACES a group's `seatIds` — it never merges — and an
 * empty array REMOVES the group outright. So every term below exists for one
 * reason: this effect must never write a list that is WORSE than the one the
 * group already carries.
 *
 * `seeded` — set by the seed/adopt effect after its first pass, once chart AND
 * availability have both loaded. A freshly mounted controller's `myHolds`
 * starts at `[]` (both queries still in flight), so syncing on the very first
 * reactive flush would strip a group whose seats already exist server-side,
 * unmounting this very component mid-hand-off and losing the group for good
 * (no `#each` entry left to remount from).
 *
 * `holdCount > 0` — `seeded` alone was NOT enough (#918). The seed reads a
 * query-cache entry, and "has data" is not "is fresh": the availability query
 * carries no `staleTime` and the picker's post-tap refetch is fire-and-forget,
 * so the snapshot a group's controller mounts onto is routinely the PRE-hold
 * one (`my_holds: []`). The seed then legitimately produced nothing, `seeded`
 * flipped true anyway, and this effect wrote that `[]` straight through —
 * deleting the group the picker had created milliseconds earlier, and with it
 * the component that would have repaired the group once the refetch landed.
 *
 * `unresolvedClaims === 0` — the same failure one size down (#918 review).
 * `holdCount > 0` stops a group being DELETED; it does nothing about a group
 * being SHRUNK. A group claiming [A, B] whose controller resolved only [A] —
 * B absent from the warm `['seating-chart', eventId]` entry, or inactive, or
 * excluded because another registered controller holds it — reports a hold
 * count of 1 and passes, and the write drops B from the buyer's cart with no
 * symptom at all. `adoptServerHolds` cannot bring B back: it filters through
 * the same frozen `#validSeatIds`. So the write is withheld until the
 * controller has resolved EVERY seat the group claimed at mount. A merely
 * stale or narrow chart resolves on a later adopt and the sync opens; a
 * permanently invalid seat leaves the group holding exactly what the buyer
 * picked, which fails loudly at checkout rather than quietly selling them one
 * seat fewer than they chose. Silent loss is the worse failure.
 *
 * Shrinking and emptying a group belong to the writers that do it EXPLICITLY,
 * none of which routes through here: the seat picker
 * (`SeatPickerDialog.handleDone` / `seatPickerCloseAction`), the
 * venue-overview hand-off (the event page's `handleSelectTier`), and the
 * event-wide expiry sweep (`CartSeatHolds.handleExpiry`).
 *
 * `best_available` groups never sync (seats aren't picked, they're assigned at
 * confirm — Task 8), regardless of everything above.
 */
export function shouldSyncSeatIds(
	isUserChoice: boolean,
	seeded: boolean,
	holdCount: number,
	unresolvedClaims: number
): boolean {
	return isUserChoice && seeded && holdCount > 0 && unresolvedClaims === 0;
}
