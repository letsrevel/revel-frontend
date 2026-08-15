import { describe, expect, it } from 'vitest';
import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import type { SeatData } from './seat-grid-types';
import { applyRectangle, rectangleBounds } from './seat-grid-rect.svelte';

const keyFor = (row: number, col: number) => `${row}-${col}`;

const seat = (overrides: Partial<SeatData> = {}): SeatData => ({
	exists: true,
	is_accessible: false,
	is_obstructed_view: false,
	...overrides
});

function harness(entries: Array<[string, SeatData]> = []) {
	return {
		seats: new SvelteMap<string, SeatData>(entries),
		selectedCells: new SvelteSet<string>(),
		keyFor
	};
}

describe('rectangleBounds', () => {
	it('normalizes a drag in any direction', () => {
		expect(rectangleBounds({ row: 3, col: 5 }, { row: 1, col: 2 })).toEqual({
			minRow: 1,
			maxRow: 3,
			minCol: 2,
			maxCol: 5
		});
	});
});

describe('applyRectangle — fill', () => {
	it('fills every empty cell when both corners are empty', () => {
		const { seats, selectedCells } = harness();
		applyRectangle({
			seats,
			selectedCells,
			start: { row: 0, col: 0 },
			end: { row: 1, col: 1 },
			activePaint: null,
			keyFor
		});
		expect(seats.size).toBe(4);
		expect(seats.get('1-1')).toEqual(seat());
		expect(selectedCells.size).toBe(0);
	});

	it('keeps a configured seat inside the rectangle intact', () => {
		const configured = seat({ priceCategoryId: 'cat-vip', is_accessible: true });
		const { seats, selectedCells } = harness([['0-1', configured]]);
		applyRectangle({
			seats,
			selectedCells,
			start: { row: 0, col: 0 },
			end: { row: 0, col: 2 },
			activePaint: null,
			keyFor
		});
		// The fill ADDS the missing seats and never resets the existing one.
		expect(seats.get('0-1')).toEqual(configured);
		expect(seats.get('0-0')).toEqual(seat());
		expect(seats.get('0-2')).toEqual(seat());
	});
});

describe('applyRectangle — paint and select', () => {
	it('paints only existing seats when a chip is armed', () => {
		const { seats, selectedCells } = harness([['0-0', seat()]]);
		applyRectangle({
			seats,
			selectedCells,
			start: { row: 0, col: 0 },
			end: { row: 0, col: 1 },
			activePaint: { categoryId: 'cat-1' },
			keyFor
		});
		expect(seats.get('0-0')?.priceCategoryId).toBe('cat-1');
		expect(seats.has('0-1')).toBe(false);
	});

	it('selects the existing seats when a corner holds a seat', () => {
		const { seats, selectedCells } = harness([
			['0-0', seat()],
			['0-2', seat()]
		]);
		applyRectangle({
			seats,
			selectedCells,
			start: { row: 0, col: 0 },
			end: { row: 0, col: 2 },
			activePaint: null,
			keyFor
		});
		expect([...selectedCells].sort()).toEqual(['0-0', '0-2']);
		expect(seats.size).toBe(2);
	});
});
