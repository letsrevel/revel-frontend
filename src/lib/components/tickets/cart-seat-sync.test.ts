import { describe, it, expect } from 'vitest';
import { shouldSyncSeatIds } from './cart-seat-sync';

describe('shouldSyncSeatIds', () => {
	it('is false for user_choice before any seed/adopt pass has run', () => {
		// The critical case: myHolds is still [] on first flush — syncing here
		// would remove the group via setSeatIds([]) before adoption can land it.
		expect(shouldSyncSeatIds(true, false, 0, 1)).toBe(false);
	});

	it('is true for user_choice once a seed/adopt pass has resolved every claim', () => {
		expect(shouldSyncSeatIds(true, true, 1, 0)).toBe(true);
		expect(shouldSyncSeatIds(true, true, 3, 0)).toBe(true);
	});

	// #918: `seeded` alone said "an empty myHolds is trustworthy now", but the
	// seed reads a query-cache entry that may still be the PRE-hold availability
	// snapshot — so it can flip `seeded` true while legitimately producing
	// nothing. Writing that [] through deletes the group the picker created
	// milliseconds earlier, AND unmounts the component that would have repaired
	// it when the refetch landed.
	it('is false for a seeded pass that produced no holds — it must never delete a group', () => {
		expect(shouldSyncSeatIds(true, true, 0, 1)).toBe(false);
		expect(shouldSyncSeatIds(true, true, 0, 0)).toBe(false);
	});

	// #918 review: `holdCount > 0` only stops DELETION. `cart.setSeatIds`
	// REPLACES, so a group claiming two seats whose controller resolved one
	// still passes a positive hold count and the write silently drops the
	// other. A partial resolution must withhold the write entirely.
	it('is false while any seat the group claimed is still unresolved', () => {
		expect(shouldSyncSeatIds(true, true, 1, 1)).toBe(false);
		expect(shouldSyncSeatIds(true, true, 2, 3)).toBe(false);
	});

	it('is false for best_available regardless of every other term', () => {
		expect(shouldSyncSeatIds(false, false, 0, 0)).toBe(false);
		expect(shouldSyncSeatIds(false, true, 0, 0)).toBe(false);
		expect(shouldSyncSeatIds(false, true, 2, 0)).toBe(false);
	});
});
