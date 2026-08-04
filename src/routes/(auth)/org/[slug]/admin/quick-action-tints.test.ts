import { describe, it, expect } from 'vitest';
import { assignQuickActionTints, TINTS } from './quick-action-tints';

/**
 * Locks the "no grid-adjacent tile repeats a tint" property for both
 * quick-actions grid variants (12 tiles = non-owner, 14 = owner) across both
 * column counts the grid actually uses (md:grid-cols-2 -> offset 2,
 * lg:grid-cols-4 -> offset 4), plus the horizontal same-row offset of 1.
 */
function expectNoAdjacentRepeats(length: number) {
	const items = Array.from({ length }, (_, i) => ({ id: i }));
	const tinted = assignQuickActionTints(items);

	for (const offset of [1, 2, 4]) {
		for (let i = 0; i + offset < tinted.length; i++) {
			expect(tinted[i].tint, `offset=${offset} i=${i} length=${length}`).not.toBe(
				tinted[i + offset].tint
			);
		}
	}
}

describe('assignQuickActionTints', () => {
	it('never repeats a tint at grid-adjacent offsets — non-owner grid (12 tiles)', () => {
		expectNoAdjacentRepeats(12);
	});

	it('never repeats a tint at grid-adjacent offsets — owner grid (14 tiles)', () => {
		expectNoAdjacentRepeats(14);
	});

	it('cycles through every tint at least once across 14 tiles', () => {
		const tinted = assignQuickActionTints(Array.from({ length: 14 }, (_, i) => i));
		expect(new Set(tinted.map((t) => t.tint)).size).toBe(TINTS.length);
	});

	it('preserves the original item fields alongside the assigned tint', () => {
		const [first] = assignQuickActionTints([{ title: 'Events', href: '/events' }]);
		expect(first.title).toBe('Events');
		expect(first.href).toBe('/events');
		expect(first.tint).toBe(TINTS[0]);
	});
});
