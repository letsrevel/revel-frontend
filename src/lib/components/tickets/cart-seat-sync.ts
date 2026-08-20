/**
 * Whether `CartSeatGroupHolds` should push `controller.myHolds` into
 * `cart.setSeatIds` right now (#853 PR 3).
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
 * pre-existing holds, so an empty `myHolds` at that point is trustworthy.
 *
 * `best_available` groups never sync (seats aren't picked, they're
 * assigned at confirm — Task 8), regardless of `seeded`.
 */
export function shouldSyncSeatIds(isUserChoice: boolean, seeded: boolean): boolean {
	return isUserChoice && seeded;
}
