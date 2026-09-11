/**
 * Whether `CartSeatGroupHolds` should push `controller.myHolds` into
 * `cart.setSeatIds` right now (#853 PR 3, hardened in #918).
 *
 * `cart.setSeatIds(tier, [])` REMOVES the group from the cart — that's its
 * documented behavior for an empty array, not "no seats yet". A freshly
 * mounted controller's `myHolds` starts at `[]` (chart/availability are
 * still in flight), so syncing on the very first reactive flush would strip
 * a group whose seats already exist server-side (the venue-overview
 * hand-off, or a re-mount of an existing group) before the seed/adopt
 * effect has had a chance to land them — unmounting this very component
 * mid-hand-off and losing it for good (no `#each` entry left to remount
 * from). Gating on `seeded` (set by the seed/adopt effect after its first
 * successful pass, once chart+availability have both loaded) means the
 * sync never fires until there's been at least one real chance to adopt
 * pre-existing holds.
 *
 * `seeded` alone was NOT enough (#918). The seed reads a query-cache entry,
 * and "has data" is not "is fresh": the availability query carries no
 * `staleTime` and the picker's post-tap refetch is fire-and-forget, so the
 * snapshot a group's controller mounts onto is routinely the PRE-hold one
 * (`my_holds: []`). The seed then legitimately produced nothing, `seeded`
 * flipped true anyway, and this effect wrote that `[]` straight through —
 * deleting the group the picker had created milliseconds earlier, and with
 * it the component that would have repaired the group once the refetch
 * landed. So the live-sync effect must never be ABLE to delete a group:
 * `holdCount > 0` makes it a strictly additive writer.
 *
 * Deletion is legitimately owned by the two writers that clear `seatIds`
 * explicitly, neither of which routes through here: the picker
 * (`SeatPickerDialog.handleDone` / `seatPickerCloseAction`) and the
 * event-wide expiry sweep (`CartSeatHolds.handleExpiry`).
 *
 * `best_available` groups never sync (seats aren't picked, they're
 * assigned at confirm — Task 8), regardless of `seeded`.
 */
export function shouldSyncSeatIds(
	isUserChoice: boolean,
	seeded: boolean,
	holdCount: number
): boolean {
	return isUserChoice && seeded && holdCount > 0;
}
