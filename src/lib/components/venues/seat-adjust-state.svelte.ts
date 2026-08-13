/**
 * "Adjust seats" mode: the deliberate friction between normal grid editing
 * (click = toggle/paint a cell) and free-form seat placement.
 *
 * Only while the mode is ON does a seat button become draggable and a single
 * click SELECT a seat for the inspector. Everything the mode owns lives here —
 * the flag, the selection, the live drag offset — plus the pure recipe helpers
 * that turn a gesture into a `SeatNudge`.
 *
 * Nudge addressing: `(row_order rank, adjacency_index)`, never physical grid
 * (row, col) — see `SeatNudge` in row-layout.ts. Callers translate with the
 * editor's rank lookup before calling in here.
 */
import type { SeatData } from './seat-grid-types';
import { ROW_SHIFT_LIMIT, type RowLayoutRecipe, type SeatNudge } from './row-layout';
import { buildRowOrderLookup } from './seat-grid-save';

/** Free-drag rounding, in seat-pitch units. */
export const NUDGE_STEP = 0.1;
/** Coarse (Shift-held, and Shift+arrow) rounding, in seat-pitch units. */
export const NUDGE_COARSE_STEP = 0.5;
/** Rotation input step, in degrees. */
export const ROTATION_STEP = 15;

/** Arrow-key nudge directions — the pointer-free equivalent of a drag. */
export const ARROW_NUDGE: Record<string, { dx: number; dy: number }> = {
	ArrowLeft: { dx: -1, dy: 0 },
	ArrowRight: { dx: 1, dy: 0 },
	ArrowUp: { dx: 0, dy: -1 },
	ArrowDown: { dx: 0, dy: 1 }
};

export interface SeatRef {
	row: number;
	col: number;
}

/** A patch onto one seat's nudge; `undefined` leaves that field untouched. */
export interface NudgePatch {
	dx?: number;
	dy?: number;
	rot?: number;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

/**
 * Round a nudge component to the active snap grid and clamp it to the
 * persisted limit. `+ 0` normalizes -0 to 0 so a reset-to-centre never
 * serializes as `-0`.
 */
export function snapNudge(value: number, coarse = false): number {
	const step = coarse ? NUDGE_COARSE_STEP : NUDGE_STEP;
	return roundNudge(Math.round(value / step) * step);
}

/**
 * Clamp to the persisted limit and drop binary-float noise (0.1 * 3 =
 * 0.30000000000000004), WITHOUT snapping to the drag grid — typed inspector
 * values are taken at face value. `+ 0` normalizes -0 to 0.
 */
export function roundNudge(value: number): number {
	return clamp(Math.round(value * 100) / 100, -ROW_SHIFT_LIMIT, ROW_SHIFT_LIMIT) + 0;
}

/** Wrap degrees into [-180, 180), matching row-layout's persistence parser. */
export function normalizeRotationInput(value: number): number {
	const wrapped = ((value % 360) + 360) % 360;
	return (wrapped >= 180 ? wrapped - 360 : wrapped) + 0;
}

export function findNudge(
	recipe: RowLayoutRecipe,
	row: number,
	seat: number
): SeatNudge | undefined {
	return recipe.seatNudges.find((nudge) => nudge.row === row && nudge.seat === seat);
}

/**
 * Write one seat's nudge — REPLACING any existing entry for that (row, seat),
 * never appending a second one. The bake applies every matching entry in turn,
 * so a duplicate would compound the delta (and the parser has no dedupe of its
 * own). An entry whose dx/dy/rot are all zero/absent is dropped entirely: it is
 * indistinguishable from "no nudge" and would only be dead weight in metadata.
 */
export function upsertNudge(
	recipe: RowLayoutRecipe,
	row: number,
	seat: number,
	patch: NudgePatch
): RowLayoutRecipe {
	const current = findNudge(recipe, row, seat);
	const merged: SeatNudge = { row, seat };
	const dx = patch.dx ?? current?.dx;
	const dy = patch.dy ?? current?.dy;
	const rot = patch.rot ?? current?.rot;
	if (dx) merged.dx = dx;
	if (dy) merged.dy = dy;
	if (rot) merged.rot = rot;

	const rest = recipe.seatNudges.filter((nudge) => !(nudge.row === row && nudge.seat === seat));
	const effective = merged.dx !== undefined || merged.dy !== undefined || merged.rot !== undefined;
	return {
		...recipe,
		seatNudges: sortNudges(effective ? [...rest, merged] : rest)
	};
}

/** Remove one seat's nudge (the inspector's "Reset seat"). */
export function clearNudge(recipe: RowLayoutRecipe, row: number, seat: number): RowLayoutRecipe {
	return {
		...recipe,
		seatNudges: recipe.seatNudges.filter((nudge) => !(nudge.row === row && nudge.seat === seat))
	};
}

/** Deterministic order so a saved recipe doesn't churn on every edit. */
function sortNudges(nudges: SeatNudge[]): SeatNudge[] {
	return [...nudges].sort((a, b) => a.row - b.row || a.seat - b.seat);
}

/** One row's baked baseline y, for "add a seat where I clicked". */
export interface RowCenterline {
	/** Physical grid row index. */
	row: number;
	y: number;
}

/**
 * The row whose baked centreline is closest to `y`. Ties go to the lower row
 * index (stable, and the first match wins for a caller iterating top-down).
 * `null` when there are no rows at all.
 */
export function nearestRowIndex(centerlines: readonly RowCenterline[], y: number): number | null {
	let best: RowCenterline | null = null;
	let bestDistance = Number.POSITIVE_INFINITY;
	for (const line of centerlines) {
		const distance = Math.abs(line.y - y);
		if (distance < bestDistance) {
			best = line;
			bestDistance = distance;
		}
	}
	return best === null ? null : best.row;
}

/**
 * The column index a seat appended to `row` takes: one past the row's
 * right-most existing seat, or 0 for an empty row. Gaps inside the row are
 * deliberately NOT filled — "add to this row" means "at the end of the row",
 * which is where an extra chair physically goes.
 */
export function nextColumnInRow(cells: ReadonlyMap<string, SeatData>, row: number): number {
	let next = 0;
	for (const [key, data] of cells) {
		if (!data.exists) continue;
		const [cellRow, cellCol] = key.split('-').map(Number);
		if (cellRow !== row || !Number.isInteger(cellCol)) continue;
		next = Math.max(next, cellCol + 1);
	}
	return next;
}

/**
 * Re-address every nudge after the set of POPULATED rows changed.
 *
 * Nudges are keyed by row_order RANK (dense over populated rows), so making an
 * empty row populated re-ranks every row behind it — and a nudge that isn't
 * re-mapped would silently start moving a different seat. Nudges whose row no
 * longer exists are dropped.
 */
export function remapNudgeRanks(
	recipe: RowLayoutRecipe,
	rowsBefore: readonly number[],
	rowsAfter: readonly number[],
	invertRowOrder: boolean
): RowLayoutRecipe {
	const rankBefore = buildRowOrderLookup(rowsBefore, invertRowOrder);
	const rankAfter = buildRowOrderLookup(rowsAfter, invertRowOrder);
	// Throwaway lookups, built and dropped inside this pure function — nothing
	// here is ever read from a template, so plain Map/Set are correct.
	/* eslint-disable svelte/prefer-svelte-reactivity */
	const rowByOldRank = new Map<number, number>();
	for (const row of new Set(rowsBefore)) rowByOldRank.set(rankBefore(row), row);
	const survivors = new Set(rowsAfter);
	/* eslint-enable svelte/prefer-svelte-reactivity */

	const remapped: SeatNudge[] = [];
	for (const nudge of recipe.seatNudges) {
		const row = rowByOldRank.get(nudge.row);
		if (row === undefined || !survivors.has(row)) continue;
		remapped.push({ ...nudge, row: rankAfter(row) });
	}
	return { ...recipe, seatNudges: sortNudges(remapped) };
}

/**
 * Mirror every rank-addressed entry after `invertRowOrder` flipped.
 *
 * SEMANTICS: **seat follows seat.** Inverting a sector changes labels and
 * row_order ranks; it never moves the physical room (the bake has no inversion
 * term at all — see seat-layout-bake's frame contract). So a nudged seat must
 * keep ITS nudge: rank `r` becomes `maxRank - r` for both `seatNudges` and
 * `rowOverrides`, which is exactly the transform `buildRowOrderLookup` applies
 * to the same physical row. Without this, every rank-addressed entry silently
 * re-targets its mirror row and nudged seats teleport.
 *
 * `rowCount` is the number of POPULATED rows (the rank space's size). Entries
 * outside that space are orphans and get dropped.
 */
export function mirrorRowRanks(recipe: RowLayoutRecipe, rowCount: number): RowLayoutRecipe {
	const maxRank = rowCount - 1;
	const inRange = (rank: number) => rank >= 0 && rank <= maxRank;
	return {
		...recipe,
		rowOverrides: recipe.rowOverrides
			.filter((override) => inRange(override.row))
			.map((override) => ({ ...override, row: maxRank - override.row }))
			.sort((a, b) => a.row - b.row),
		seatNudges: sortNudges(
			recipe.seatNudges
				.filter((nudge) => inRange(nudge.row))
				.map((nudge) => ({ ...nudge, row: maxRank - nudge.row }))
		)
	};
}

/**
 * The grid's column count after appending a seat at `col`: the grid grows by
 * exactly the columns needed, never shrinks. Appending past the right edge is
 * legal — the row simply gets one more column than the grid had.
 */
export function growColumns(columns: number, col: number): number {
	return Math.max(columns, col + 1);
}

/**
 * Mode + selection + live drag state. Held by SeatGridEditor and passed to both
 * the grid (gesture source) and the adjust panel (inspector), so there is one
 * selection, not two.
 */
export class SeatAdjustState {
	/** Adjust mode on/off — the friction gate for dragging and selection. */
	active = $state(false);
	/** "Add seat anywhere" sub-toggle; only meaningful while `active`. */
	addArmed = $state(false);
	/** The seat the inspector edits, as a physical grid cell. */
	selected = $state<SeatRef | null>(null);
	/** Live pointer offset of the seat being dragged, in PIXELS (not units). */
	drag = $state<{ key: string; dx: number; dy: number } | null>(null);

	setActive(active: boolean): void {
		this.active = active;
		if (!active) {
			this.addArmed = false;
			this.selected = null;
			this.drag = null;
		}
	}

	toggleActive(): void {
		this.setActive(!this.active);
	}

	setAddArmed(armed: boolean): void {
		this.addArmed = armed && this.active;
	}

	/**
	 * Select a seat for the inspector. A no-op while the mode is off — the
	 * inspector isn't on screen then, and a selection made now would surface as
	 * a stale one the moment the mode is switched on.
	 */
	select(ref: SeatRef | null): void {
		if (ref !== null && !this.active) return;
		this.selected = ref;
	}

	/** True for the cell the inspector currently targets. */
	isSelected(row: number, col: number): boolean {
		return this.selected?.row === row && this.selected?.col === col;
	}

	/** Live pixel offset for a cell mid-drag; zero for every other cell. */
	offsetFor(key: string): { dx: number; dy: number } {
		const drag = this.drag;
		return drag !== null && drag.key === key ? { dx: drag.dx, dy: drag.dy } : { dx: 0, dy: 0 };
	}
}

/** Pointer travel (px) before a press turns into a drag rather than a click. */
export const DRAG_THRESHOLD_PX = 3;

export interface SeatDragOptions {
	/** Pixels per seat pitch, for converting the drop into recipe units. */
	cellPx: number;
	/** Commit the finished gesture as a delta onto the seat's own nudge. */
	onCommit: (row: number, col: number, delta: { dx: number; dy: number }, coarse: boolean) => void;
}

/**
 * One seat drag, from pointerdown to pointerup.
 *
 * The gesture never touches the recipe while it runs — it only moves the button
 * visually (`SeatAdjustState.drag`, in pixels) — and commits ONE delta on
 * release, which is what makes a whole drag a single undo entry. A press that
 * never passes the threshold stays a click (i.e. a selection).
 */
export class SeatDragController {
	private origin: { x: number; y: number } | null = null;
	private cell: SeatRef | null = null;
	private moved = false;

	constructor(
		/**
		 * Read lazily: the host passes a prop, and a prop read at construction
		 * time would freeze on its initial value (Svelte's
		 * `state_referenced_locally`). `null` = no adjust mode on this host.
		 */
		private readonly state: () => SeatAdjustState | null,
		private readonly options: SeatDragOptions
	) {}

	/** True once the current press has travelled far enough to be a drag. */
	get isDragging(): boolean {
		return this.moved;
	}

	start(row: number, col: number, event: PointerEvent): void {
		this.origin = { x: event.clientX, y: event.clientY };
		this.cell = { row, col };
		this.moved = false;
	}

	move(event: PointerEvent): void {
		const origin = this.origin;
		const cell = this.cell;
		if (origin === null || cell === null) return;
		const dx = event.clientX - origin.x;
		const dy = event.clientY - origin.y;
		if (!this.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
		this.moved = true;
		const state = this.state();
		if (state) state.drag = { key: `${cell.row}-${cell.col}`, dx, dy };
	}

	/** Finish the gesture; returns true when it committed a move. */
	finish(event: PointerEvent): boolean {
		const origin = this.origin;
		const cell = this.cell;
		const moved = this.moved;
		this.cancel();
		if (origin === null || cell === null || !moved) return false;
		this.options.onCommit(
			cell.row,
			cell.col,
			{
				dx: (event.clientX - origin.x) / this.options.cellPx,
				dy: (event.clientY - origin.y) / this.options.cellPx
			},
			event.shiftKey
		);
		return true;
	}

	cancel(): void {
		this.origin = null;
		this.cell = null;
		this.moved = false;
		const state = this.state();
		if (state) state.drag = null;
	}
}
