import { describe, it, expect } from 'vitest';
import { shouldSyncSeatIds } from './cart-seat-sync';

describe('shouldSyncSeatIds', () => {
	it('is false for user_choice before any seed/adopt pass has run', () => {
		// The critical case: myHolds is still [] on first flush — syncing here
		// would remove the group via setSeatIds([]) before adoption can land it.
		expect(shouldSyncSeatIds(true, false)).toBe(false);
	});

	it('is true for user_choice once a seed/adopt pass has run', () => {
		expect(shouldSyncSeatIds(true, true)).toBe(true);
	});

	it('is false for best_available regardless of seeded', () => {
		expect(shouldSyncSeatIds(false, false)).toBe(false);
		expect(shouldSyncSeatIds(false, true)).toBe(false);
	});
});
