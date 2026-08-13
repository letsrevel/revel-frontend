/**
 * Pure hydration of the sector editor's initial state from what the backend
 * returns (existing seats + sector.metadata), plus the label vocabulary the
 * whole editor addresses cells with.
 *
 * Extracted from SeatGridEditor verbatim (behaviour unchanged) so the component
 * stays inside its file cap and so the label/inference rules — which decide
 * whether a save RELABELS every seat — are unit-testable on their own.
 */
import type { VenueSeatSchema } from '$lib/api/generated/types.gen';
import type { SeatData } from './seat-grid-types';
import { readExistingPaint } from './seat-grid-save';
import {
	defaultRowLayout,
	hasCustomSeatPositions,
	parseRowLayout,
	type RowLayoutRecipe
} from './row-layout';

/** Aisle metadata structure stored in sector.metadata. */
export interface AisleMetadata {
	/** Column indices after which aisles appear. */
	verticalAisles: number[];
	/** Row indices after which aisles appear. */
	horizontalAisles: number[];
	/** If true, row A is at the bottom. */
	invertRowOrder: boolean;
}

/** Row label (A, B, C… or 1, 2, 3…) for a zero-based row index. */
export function rowLabelFor(index: number, useLetters: boolean): string {
	if (!useLetters) return String(index + 1);
	let label = '';
	let i = index;
	do {
		label = String.fromCharCode(65 + (i % 26)) + label;
		i = Math.floor(i / 26) - 1;
	} while (i >= 0);
	return label;
}

/**
 * Seat label from row and column. Numeric rows use a separator so "1-1" can't
 * be read as "11".
 */
export function seatLabelFor(rowIndex: number, colIndex: number, useLetters: boolean): string {
	const rowLabel = rowLabelFor(rowIndex, useLetters);
	return useLetters ? `${rowLabel}${colIndex + 1}` : `${rowLabel}-${colIndex + 1}`;
}

/** The editor's cell key: physical grid coordinates, never ranks. */
export function cellKeyFor(row: number, col: number): string {
	return `${row}-${col}`;
}

/** Parse a row label ("A", "AA", or "3") into a zero-based index; -1 if unparseable. */
export function parseRowLabelToIndex(rowLabel: string): number {
	if (/^\d+$/.test(rowLabel)) {
		return parseInt(rowLabel, 10) - 1;
	}
	if (/^[A-Z]+$/i.test(rowLabel)) {
		const upper = rowLabel.toUpperCase();
		let index = 0;
		for (let i = 0; i < upper.length; i++) {
			index = index * 26 + (upper.charCodeAt(i) - 64);
		}
		return index - 1;
	}
	return -1;
}

export interface HydrateInput {
	existingSeats: VenueSeatSchema[];
	sectorMetadata?: Record<string, unknown> | null;
	/** The editor's current defaults; the grid only ever grows to fit. */
	rows: number;
	columns: number;
	useLetters: boolean;
}

export interface HydratedGrid {
	cells: Array<[string, SeatData]>;
	aisles: AisleMetadata | null;
	rows: number;
	columns: number;
	useLetters: boolean;
	rowLayout: RowLayoutRecipe;
	rowLayoutRaw: Record<string, unknown> | undefined;
	rowLayoutUnsupported: boolean;
	rowLayoutUnsupportedRaw: unknown;
	/** Seats carry custom positions but no recipe — warn, don't block. */
	rowLayoutDesynced: boolean;
}

/**
 * Read the persisted sector into the editor's starting state. Every field is a
 * plain overwrite for the caller (never additive), so re-running this on a
 * reloaded sector cannot merge two rooms together.
 */
export function hydrateGrid(input: HydrateInput): HydratedGrid {
	const { existingSeats, sectorMetadata } = input;

	const rawAisles = sectorMetadata?.aisles as AisleMetadata | undefined;
	const aisles: AisleMetadata | null = rawAisles
		? {
				verticalAisles: [...(rawAisles.verticalAisles || [])],
				horizontalAisles: [...(rawAisles.horizontalAisles || [])],
				invertRowOrder: rawAisles.invertRowOrder ?? false
			}
		: null;

	// The row-geometry recipe (admin-only key; absent for every plain grid).
	const parsed = parseRowLayout(sectorMetadata);
	const unsupported = parsed.status === 'unsupported';
	const recipeState =
		parsed.status === 'ok'
			? {
					rowLayout: parsed.recipe,
					rowLayoutRaw: parsed.raw,
					rowLayoutUnsupported: false,
					rowLayoutUnsupportedRaw: undefined,
					rowLayoutDesynced: false
				}
			: {
					rowLayout: defaultRowLayout(),
					rowLayoutRaw: undefined,
					rowLayoutUnsupported: unsupported,
					rowLayoutUnsupportedRaw: unsupported ? sectorMetadata?.rowLayout : undefined,
					// Only 'absent' can be a desync: an 'unsupported' blob has its own,
					// more specific banner and its own preservation rule.
					rowLayoutDesynced: parsed.status === 'absent' && hasCustomSeatPositions(existingSeats)
				};

	// Infer grid size and labelling from the existing seats.
	const cells: Array<[string, SeatData]> = [];
	let maxRow = 0;
	let maxCol = 0;
	let sawNumericRow = false;
	let sawLetterRow = false;

	for (const seat of existingSeats) {
		let rowIndex = -1;
		let colNum = -1;
		let rowIsNumeric = false;

		// Prefer the explicit row/number fields (row_label, with the transitional
		// `row` alias as fallback) — labels alone are ambiguous for numeric rows.
		const rowLabel = seat.row_label ?? seat.row;
		if (rowLabel && seat.number !== null && seat.number !== undefined) {
			rowIndex = parseRowLabelToIndex(rowLabel);
			colNum = seat.number - 1;
			rowIsNumeric = /^\d+$/.test(rowLabel);
		}

		// Fall back to parsing the label ("A1" letter-row or "1-1" numeric-row style).
		if (rowIndex < 0 || colNum < 0) {
			const letterMatch = seat.label.match(/^([A-Z]+)(\d+)$/i);
			const numericMatch = seat.label.match(/^(\d+)-(\d+)$/);
			if (letterMatch) {
				rowIndex = parseRowLabelToIndex(letterMatch[1]);
				colNum = parseInt(letterMatch[2], 10) - 1;
				rowIsNumeric = false;
			} else if (numericMatch) {
				rowIndex = parseRowLabelToIndex(numericMatch[1]);
				colNum = parseInt(numericMatch[2], 10) - 1;
				rowIsNumeric = true;
			}
		}

		if (rowIndex < 0 || colNum < 0) continue;

		if (rowIsNumeric) sawNumericRow = true;
		else sawLetterRow = true;

		maxRow = Math.max(maxRow, rowIndex);
		maxCol = Math.max(maxCol, colNum);

		// Keep the backend's accessibility flags and painted category
		// (price_category_id, BE #734) so existing paint shows on reload. An
		// undefined (untouched) baseline is never sent on save, so reloading and
		// re-saving a painted venue cannot unpaint anything.
		const persistedPaint = readExistingPaint(seat);
		cells.push([
			cellKeyFor(rowIndex, colNum),
			{
				exists: true,
				is_accessible: seat.is_accessible ?? false,
				is_obstructed_view: seat.is_obstructed_view ?? false,
				...(persistedPaint !== undefined ? { priceCategoryId: persistedPaint } : {})
			}
		]);
	}

	return {
		cells,
		aisles,
		// Numeric row labels only round-trip if the label generator stays numeric —
		// otherwise saving would relabel every seat and bulk-delete the originals.
		useLetters: sawNumericRow && !sawLetterRow ? false : input.useLetters,
		rows: existingSeats.length > 0 ? Math.max(input.rows, maxRow + 1) : input.rows,
		columns: existingSeats.length > 0 ? Math.max(input.columns, maxCol + 1) : input.columns,
		...recipeState
	};
}
