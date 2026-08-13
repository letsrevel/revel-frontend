/**
 * What a finished rectangle gesture does to the grid — the normal-mode
 * drag-across semantics, lifted out of SeatGrid unchanged so the component
 * stays inside its file cap and the branch rules are testable on their own.
 *
 * Three outcomes, in priority order:
 *  1. paint armed  → paint every EXISTING seat inside the rectangle;
 *  2. both corners empty → fill the rectangle with seats;
 *  3. otherwise    → add every existing seat inside it to the selection.
 */
import type { SvelteMap, SvelteSet } from 'svelte/reactivity';
import type { SeatData } from './seat-grid-types';

export interface CellRef {
	row: number;
	col: number;
}

export interface RectangleInput {
	seats: SvelteMap<string, SeatData>;
	selectedCells: SvelteSet<string>;
	/** The two corners the admin actually dragged between (not normalized). */
	start: CellRef;
	end: CellRef;
	/** Active paint chip: `null` = paint off; `categoryId: null` = eraser. */
	activePaint: { categoryId: string | null } | null;
	keyFor: (row: number, col: number) => string;
}

/** The normalized bounds of a dragged rectangle. */
export function rectangleBounds(
	start: CellRef,
	end: CellRef
): { minRow: number; maxRow: number; minCol: number; maxCol: number } {
	return {
		minRow: Math.min(start.row, end.row),
		maxRow: Math.max(start.row, end.row),
		minCol: Math.min(start.col, end.col),
		maxCol: Math.max(start.col, end.col)
	};
}

const newSeat = (): SeatData => ({
	exists: true,
	is_accessible: false,
	is_obstructed_view: false
});

export function applyRectangle(input: RectangleInput): void {
	const { seats, selectedCells, start, end, activePaint, keyFor } = input;
	const { minRow, maxRow, minCol, maxCol } = rectangleBounds(start, end);

	// Both corners empty ⇒ the admin is drawing a block of seats, not selecting.
	const filling =
		!activePaint &&
		!seats.get(keyFor(start.row, start.col))?.exists &&
		!seats.get(keyFor(end.row, end.col))?.exists;

	for (let row = minRow; row <= maxRow; row++) {
		for (let col = minCol; col <= maxCol; col++) {
			const key = keyFor(row, col);
			const seat = seats.get(key);

			if (activePaint) {
				// The eraser deliberately does nothing to empty cells.
				if (seat?.exists) seats.set(key, { ...seat, priceCategoryId: activePaint.categoryId });
			} else if (filling) {
				seats.set(key, newSeat());
			} else if (seat?.exists) {
				selectedCells.add(key);
			}
		}
	}
}
