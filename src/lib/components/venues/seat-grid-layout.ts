/**
 * Pixel geometry for the WYSIWYG sector grid.
 *
 * The editor no longer draws a straight HTML lattice next to a curved SVG
 * preview — there is ONE surface, and every cell button is absolutely placed
 * at its BAKED position (seat-layout-bake.ts), the same coordinates the buyer
 * map renders at checkout. This module owns the unit -> pixel conversion and
 * nothing else: it is pure, framework-free and unit-testable.
 *
 * Frame: world units are sector-local (1 unit = 1 seat pitch). A seat at
 * (x, y) owns the unit square [x, x+1] x [y, y+1] and is drawn centred in it,
 * mirroring `SeatMap`/`SeatLayoutPreview`'s `(x + 0.5) * CELL` idiom. Shape
 * vertices are points, not cells, so they contribute their raw coordinate to
 * the bounds while seats contribute `+1` on the far edge.
 */
import type { Coordinate2d } from '$lib/api/generated/types.gen';
import type { SeatData } from './seat-grid-types';

/** Distance between adjacent cell centres, in px. */
export const CELL_PX = 48;
/** Cell button size, in px (leaves an 8px gutter at CELL_PX pitch). */
export const BUTTON_PX = 40;
/** Width of the row-label rail (Tailwind `w-14`), in px. */
export const RAIL_PX = 56;
/** Height of the column-label rail, in px. */
export const COL_RAIL_PX = 32;
/** Click/hover target size for an aisle add/remove zone, in px. */
export const AISLE_ZONE_PX = 20;

export interface CanvasFrame {
	/** World coordinate mapped to pixel 0 on each axis. */
	originX: number;
	originY: number;
	widthPx: number;
	heightPx: number;
}

export interface FrameInput {
	/** Baked positions of every drawn cell (seats AND empty click targets). */
	cells: readonly Coordinate2d[];
	/** Outline polygons drawn underneath (sector shape, proposed shape). */
	polygons?: ReadonlyArray<readonly Coordinate2d[] | null | undefined>;
}

/**
 * Bounding frame over every drawn cell and outline, in world units, converted
 * to the canvas pixel size. An empty grid still yields a 1x1 canvas so the
 * surrounding chrome keeps its shape.
 */
export function canvasFrame({ cells, polygons = [] }: FrameInput): CanvasFrame {
	const vertices = polygons.flatMap((polygon) => polygon ?? []);
	if (cells.length === 0 && vertices.length === 0) {
		return { originX: 0, originY: 0, widthPx: CELL_PX, heightPx: CELL_PX };
	}
	const xs = [...cells.map((c) => c.x), ...vertices.map((v) => v.x)];
	const ys = [...cells.map((c) => c.y), ...vertices.map((v) => v.y)];
	// Cells own a full unit square; polygon vertices are bare points.
	const farXs = [...cells.map((c) => c.x + 1), ...vertices.map((v) => v.x)];
	const farYs = [...cells.map((c) => c.y + 1), ...vertices.map((v) => v.y)];
	const originX = Math.min(...xs);
	const originY = Math.min(...ys);
	return {
		originX,
		originY,
		widthPx: (Math.max(...farXs) - originX) * CELL_PX,
		heightPx: (Math.max(...farYs) - originY) * CELL_PX
	};
}

/** Pixel offset of a world coordinate's cell EDGE (polygons, aisle bands). */
export function edgePx(value: number, origin: number): number {
	return (value - origin) * CELL_PX;
}

/** Pixel offset of a world coordinate's cell CENTRE (labels, aisle zones). */
export function centerPx(value: number, origin: number): number {
	return (value - origin + 0.5) * CELL_PX;
}

/** Absolute `left`/`top` for a BUTTON_PX-square button centred on a cell. */
export function cellButtonStyle(point: Coordinate2d, frame: CanvasFrame): string {
	const left = centerPx(point.x, frame.originX) - BUTTON_PX / 2;
	const top = centerPx(point.y, frame.originY) - BUTTON_PX / 2;
	return `left: ${round(left)}px; top: ${round(top)}px;`;
}

/**
 * Midpoint of the gap between two adjacent slots, in world units. `before`
 * occupies [before, before + 1], so the gap runs [before + 1, after]; with no
 * aisle the two touch and the midpoint is the shared boundary.
 */
export function gapCenter(before: number, after: number): number {
	return (before + 1 + after) / 2;
}

/**
 * The empty slot an aisle opens between two adjacent occupied slots, as
 * `[start, width]` in world units. Zero width when no aisle is present.
 */
export function gapBand(before: number, after: number): { start: number; width: number } {
	return { start: before + 1, width: Math.max(0, after - (before + 1)) };
}

/** Round to 2dp so inline styles stay stable strings across re-renders. */
export function round(value: number): number {
	return Math.round(value * 100) / 100;
}

/**
 * A fully populated rows x columns cell map, for baking the DISPLAY lattice.
 *
 * Empty click targets have to sit where a seat WOULD land, so the grid bakes
 * a synthetic all-exist map alongside the real one and uses it only for cells
 * with no seat. Two caveats, both accepted: per-row overrides are addressed by
 * dense rank, so an override's rank resolves against all rows here versus only
 * populated rows in the real bake; and row alignment measures every row at
 * full width. Real seats always take their position from the REAL bake, so
 * neither caveat can move a seat away from where checkout draws it.
 */
export function syntheticCells(rows: number, columns: number): Map<string, SeatData> {
	const cells = new Map<string, SeatData>();
	for (let row = 0; row < rows; row++) {
		for (let col = 0; col < columns; col++) {
			cells.set(`${row}-${col}`, {
				exists: true,
				is_accessible: false,
				is_obstructed_view: false
			});
		}
	}
	return cells;
}
