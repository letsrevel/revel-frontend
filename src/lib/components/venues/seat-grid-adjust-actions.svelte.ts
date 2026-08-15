/**
 * The "adjust seats" action cluster: nudge/rotation addressing, the per-seat
 * inspector's read/write surface, and the add/remove/reindex plumbing that
 * keeps `seatNudges`/`rowOverrides` correctly addressed across a
 * populated-row change. Lifted out of SeatGridEditor (which owns
 * rowLayout/seats/rows/columns/history as its own `$state`) into its own
 * runes class, mirroring `SeatGeometryState`, purely to stay inside the
 * file's line cap — behavior is unchanged.
 *
 * `reindexNudges`/`forgetNudgesAt`/`forgetAllNudges`/`nudgeAddress` stay
 * public: `deleteSelected` and the empty/full grid regenerators in
 * SeatGridEditor are outside the "adjust mode" cluster proper but share the
 * exact same rank-addressing bookkeeping, so they call back into this class
 * rather than duplicating it.
 */
import type { SvelteMap, SvelteSet } from 'svelte/reactivity';
import type { Coordinate2d } from '$lib/api/generated/types.gen';
import type { SeatData } from './seat-grid-types';
import type { RowLayoutRecipe } from './row-layout';
import { deriveAdjacencyIndex } from './seat-grid-save';
import type { SeatGeometryState } from './seat-grid-geometry-state.svelte';
import {
	clearNudge,
	findNudge,
	growColumns,
	mirrorRowRanks,
	nearestRowIndex,
	nextColumnInRow,
	normalizeRotationInput,
	remapNudgeRanks,
	roundNudge,
	snapNudge,
	upsertNudge,
	type NudgePatch,
	type SeatAdjustState
} from './seat-adjust-state.svelte';

export interface SeatAdjustActionsSources {
	adjust: SeatAdjustState;
	selectedCells: SvelteSet<string>;
	seats: SvelteMap<string, SeatData>;
	geometry: SeatGeometryState;
	rowLayout: () => RowLayoutRecipe;
	setRowLayout: (recipe: RowLayoutRecipe) => void;
	rows: () => number;
	setRows: (rows: number) => void;
	columns: () => number;
	setColumns: (columns: number) => void;
	invertRowOrder: () => boolean;
	getCellKey: (row: number, col: number) => string;
	getSeatLabel: (rowIndex: number, colIndex: number) => string;
	/** `history.commit()` — record an undo point before mutating. */
	commit: () => void;
	/** `history.commitDebounced(key)` — coalesce a continuous gesture. */
	commitDebounced: (key: string) => void;
}

export class SeatAdjustActions {
	constructor(private readonly sources: SeatAdjustActionsSources) {}

	/**
	 * A physical cell as the recipe addresses it: row_order RANK (dense over
	 * populated rows) plus adjacency_index. Never physical (row, col).
	 */
	nudgeAddress = (row: number, col: number): { rank: number; seat: number } => ({
		rank: this.sources.geometry.rankForRow(row),
		seat: deriveAdjacencyIndex(col)
	});

	/**
	 * Inverse of `nudgeAddress`, for the rotation mirror: the LABEL of the seat
	 * a (rank, adjacency_index) pair addresses, `null` when it addresses no
	 * live seat. Ranks are dense over the populated rows and flip under
	 * `invertRowOrder`, so the row comes from `rankForRow`, never arithmetic.
	 */
	labelForAddress = (rank: number, seat: number): string | null => {
		const { geometry, seats, getCellKey, getSeatLabel } = this.sources;
		const row = geometry.populatedRows.find((candidate) => geometry.rankForRow(candidate) === rank);
		if (row === undefined) return null;
		if (!seats.get(getCellKey(row, seat))?.exists) return null;
		return getSeatLabel(row, seat);
	};

	/** A cell's stored rotation, for the grid's orientation notch (0 = none). */
	rotationFor = (row: number, col: number): number => {
		const { rank, seat } = this.nudgeAddress(row, col);
		return findNudge(this.sources.rowLayout(), rank, seat)?.rot ?? 0;
	};

	readonly selectedNudge = $derived.by(() => {
		const picked = this.sources.adjust.selected;
		if (picked === null) return null;
		const { rank, seat } = this.nudgeAddress(picked.row, picked.col);
		return findNudge(this.sources.rowLayout(), rank, seat) ?? null;
	});

	readonly selectedSeatLabel = $derived.by(() => {
		const picked = this.sources.adjust.selected;
		return picked === null ? null : this.sources.getSeatLabel(picked.row, picked.col);
	});

	/**
	 * Drop the nudges of seats that no longer exist. The bake silently skips a
	 * nudge that resolves to no baked position, so an orphan LOOKS harmless —
	 * but it stays in the recipe, comes back to life the moment a seat returns
	 * at that address, and poisons the "drop it where I clicked" maths, which
	 * measures the new seat's home from the bake.
	 */
	forgetNudgesAt = (addresses: ReadonlyArray<{ rank: number; seat: number }>): void => {
		for (const { rank, seat } of addresses) {
			this.sources.setRowLayout(clearNudge(this.sources.rowLayout(), rank, seat));
		}
	};

	/** Wholesale grid regeneration: every nudge is addressed at a dead seat. */
	forgetAllNudges = (): void => {
		const recipe = this.sources.rowLayout();
		if (recipe.seatNudges.length > 0) this.sources.setRowLayout({ ...recipe, seatNudges: [] });
	};

	/**
	 * Re-address nudges (and row overrides) after the POPULATED row set
	 * changed: ranks are dense, so a row that gained (or lost) its first seat
	 * re-ranks every row behind it. This is also the callback `SeatGrid` fires
	 * after a NORMAL-mode cell-mutation batch (`onCellsMutated`) — one call per
	 * click, one per drag-fill gesture — so a click-to-add or a rectangle fill
	 * that populates a previously-empty row keeps every rank-addressed entry
	 * pointed at the physical row it belongs to.
	 */
	reindexNudges = (rowsBefore: number[]): void => {
		const rowsAfter = this.sources.geometry.populatedRows;
		// Compare membership, not just size: no single batch empties one row AND
		// populates another today, but a future op that does would re-rank rows
		// at a constant count and silently corrupt every rank-addressed entry.
		if (
			rowsBefore.length === rowsAfter.length &&
			rowsBefore.every((row, index) => row === rowsAfter[index])
		) {
			return;
		}
		this.sources.setRowLayout(
			remapNudgeRanks(
				this.sources.rowLayout(),
				rowsBefore,
				rowsAfter,
				this.sources.invertRowOrder()
			)
		);
	};

	/** Add a drag/arrow delta onto the seat's OWN nudge (replace, never append). */
	handleNudgeSeat = (
		row: number,
		col: number,
		delta: { dx: number; dy: number },
		coarse: boolean
	): void => {
		const { rank, seat } = this.nudgeAddress(row, col);
		const current = findNudge(this.sources.rowLayout(), rank, seat);
		this.sources.setRowLayout(
			upsertNudge(this.sources.rowLayout(), rank, seat, {
				dx: snapNudge((current?.dx ?? 0) + delta.dx, coarse),
				dy: snapNudge((current?.dy ?? 0) + delta.dy, coarse)
			})
		);
	};

	/** Append one seat at the end of a row, growing the grid if it has to. */
	handleAddSeatToRow = (row: number): number => {
		const { seats, geometry, getCellKey, adjust } = this.sources;
		const before = geometry.populatedRows;
		const col = nextColumnInRow(seats, row);
		seats.set(getCellKey(row, col), {
			exists: true,
			is_accessible: false,
			is_obstructed_view: false
		});
		this.sources.setColumns(growColumns(this.sources.columns(), col));
		this.sources.setRows(Math.max(this.sources.rows(), row + 1));
		this.reindexNudges(before);
		// A seat that once lived here may have left a nudge behind; the new seat
		// starts at its lattice home, not wherever its predecessor was pushed.
		this.forgetNudgesAt([this.nudgeAddress(row, col)]);
		adjust.select({ row, col });
		return col;
	};

	/**
	 * Add a seat where the admin clicked: it joins the NEAREST populated row (a
	 * seat never changes row afterwards — see the panel's note) at that row's
	 * end, and a nudge carries it from there to the exact drop point.
	 */
	handleAddSeatAt = (point: Coordinate2d): void => {
		const { geometry } = this.sources;
		const row = nearestRowIndex(geometry.rowCenterlines, point.y) ?? 0;
		const col = this.handleAddSeatToRow(row);
		// Read the bake AFTER the cell exists: that is the seat's un-nudged home,
		// so the delta below is exactly what moves it under the pointer.
		const home = geometry.positionAt(row, col);
		const { rank, seat } = this.nudgeAddress(row, col);
		this.sources.setRowLayout(
			upsertNudge(this.sources.rowLayout(), rank, seat, {
				dx: snapNudge(point.x - home.x),
				dy: snapNudge(point.y - home.y)
			})
		);
	};

	/**
	 * The row-order toggle flips the rank space but moves nothing physically,
	 * so every rank-addressed entry flips with it (seat follows seat) or it
	 * would re-target its mirror row. Called from the config's own handler,
	 * never an `$effect`: an undo restores a recipe that already matches its
	 * inversion.
	 */
	handleRowOrderChange = (): void => {
		this.sources.setRowLayout(
			mirrorRowRanks(this.sources.rowLayout(), this.sources.geometry.populatedRows.length)
		);
	};

	/** Inspector writes: typed values are taken at face value, only rounded. */
	handleInspectorChange = (patch: NudgePatch): void => {
		const picked = this.sources.adjust.selected;
		if (picked === null) return;
		this.sources.commitDebounced('inspector');
		const { rank, seat } = this.nudgeAddress(picked.row, picked.col);
		this.sources.setRowLayout(
			upsertNudge(this.sources.rowLayout(), rank, seat, {
				...(patch.dx !== undefined ? { dx: roundNudge(patch.dx) } : {}),
				...(patch.dy !== undefined ? { dy: roundNudge(patch.dy) } : {}),
				...(patch.rot !== undefined ? { rot: normalizeRotationInput(patch.rot) } : {})
			})
		);
	};

	handleResetSeat = (): void => {
		const picked = this.sources.adjust.selected;
		if (picked === null) return;
		this.sources.commit();
		const { rank, seat } = this.nudgeAddress(picked.row, picked.col);
		this.sources.setRowLayout(clearNudge(this.sources.rowLayout(), rank, seat));
	};

	/** Same effect as toggling the cell off in normal mode. */
	handleRemoveSeat = (): void => {
		const { adjust, seats, selectedCells, geometry, getCellKey } = this.sources;
		const picked = adjust.selected;
		if (picked === null) return;
		this.sources.commit();
		const before = geometry.populatedRows;
		const removed = this.nudgeAddress(picked.row, picked.col);
		const key = getCellKey(picked.row, picked.col);
		seats.delete(key);
		selectedCells.delete(key);
		adjust.select(null);
		this.forgetNudgesAt([removed]);
		this.reindexNudges(before);
	};
}
