import { describe, it, expect } from 'vitest';
import { shouldSyncSeatIds } from './cart-seat-sync';

describe('shouldSyncSeatIds', () => {
	it('is false for user_choice before any seed/adopt pass has run', () => {
		// The critical case: myHolds is still [] on first flush — syncing here
		// would remove the group via setSeatIds([]) before adoption can land it.
		expect(shouldSyncSeatIds(true, false, 0)).toBe(false);
	});

	it('is true for user_choice once a seed/adopt pass has produced holds', () => {
		expect(shouldSyncSeatIds(true, true, 1)).toBe(true);
	});

	// #918: `seeded` alone said "an empty myHolds is trustworthy now", but the
	// seed reads a query-cache entry that may still be the PRE-hold availability
	// snapshot — so it can flip `seeded` true while legitimately producing
	// nothing. Writing that [] through deletes the group the picker created
	// milliseconds earlier, AND unmounts the component that would have repaired
	// it when the refetch landed. The live-sync effect is additive-only now.
	it('is false for a seeded pass that produced no holds — it must never delete a group', () => {
		expect(shouldSyncSeatIds(true, true, 0)).toBe(false);
	});

	it('is false for best_available regardless of seeded or hold count', () => {
		expect(shouldSyncSeatIds(false, false, 0)).toBe(false);
		expect(shouldSyncSeatIds(false, true, 0)).toBe(false);
		expect(shouldSyncSeatIds(false, true, 2)).toBe(false);
	});
});
