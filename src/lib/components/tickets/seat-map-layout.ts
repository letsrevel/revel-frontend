/**
 * Pure geometry layer for the SVG seat map (no runes, no DOM).
 *
 * Turns a VenueChartSchema into unit-space coordinates SeatMap.svelte can
 * scale to pixels:
 *
 * - Seats with an explicit `position` (present on EVERY seat of a sector) are
 *   passed through, normalized so the sector's own minimum lands at (0, 0).
 *   When such a sector also has a shape, seats and shape are normalized in ONE
 *   shared frame (single minimum over shape vertices ∪ seat positions): the
 *   designer persists both in the same coordinate frame, and independent
 *   minima would snap the shape onto the seats' origin and lose their
 *   relative placement.
 * - Otherwise a grid is derived from row_order/row_label (rows; front row 0 at
 *   the top, nearest the stage) and adjacency_index (columns), honoring the
 *   sector.metadata.aisles contract the grid editor writes
 *   (verticalAisles/horizontalAisles gaps + invertRowOrder).
 * - Standing sectors become a seatless zone sized relative to capacity.
 * - Each sector carries a SectorTransform (from sector-transform.ts) that
 *   places+rotates its whole LOCAL frame into venue "world" space: a parsed
 *   `metadata.transform`, or an implicit stacked transform (defaultStacked-
 *   Transform) reproducing today's vertical display_order stacking for
 *   un-arranged sectors. Seats and shapes stay in sector-local coordinates —
 *   the transform is applied ON TOP by the renderer. The overall world
 *   bounding box (rotated sector AABBs unioned) drives the viewBox.
 */
import type {
	ChartSeatSchema,
	ChartSectorSchema,
	Coordinate2d,
	VenueChartSchema
} from '$lib/api/generated/types.gen';
import {
	applyTransform,
	defaultStackedTransform,
	parseSectorTransform,
	SECTOR_GAP,
	type SectorTransform
} from './sector-transform';

// Re-exported for the historical consumers that imported it from here
// (designer-model.ts, designer-model.test.ts); its home is sector-transform.ts.
export { SECTOR_GAP };
export type { SectorTransform };

/** The aisle contract written by SeatGridEditor into sector.metadata.aisles. */
export interface AisleLayoutMetadata {
	/** Column indices after which a vertical aisle gap appears. */
	verticalAisles: number[];
	/** Row indices (logical, front row = 0) after which a horizontal gap appears. */
	horizontalAisles: number[];
	/** When true, logical row 0 (row A) renders at the bottom, far from the stage. */
	invertRowOrder: boolean;
}

/** A seat placed in sector-local unit space (1 unit = one seat cell). */
export interface SeatPoint {
	seatId: string;
	label: string;
	x: number;
	y: number;
}

export interface SectorLayout {
	id: string;
	name: string;
	kind: 'seated' | 'standing';
	/** Backdrop polygon, normalized to the sector's local origin; null if absent. */
	shape: Coordinate2d[] | null;
	/** Places+rotates this sector's local frame into venue world space. */
	transform: SectorTransform;
	seats: SeatPoint[];
	width: number;
	height: number;
}

export interface SeatMapLayout {
	sectors: SectorLayout[];
	/** World bounding-box size (accounts for rotated sectors). */
	width: number;
	height: number;
	/** World bounding-box minimum — the renderer offsets by (−minX, −minY). */
	minX: number;
	minY: number;
	/** Spacing unit (always 1.0 — consumers multiply by their px-per-unit). */
	unit: number;
}

const EMPTY_AISLES: AisleLayoutMetadata = {
	verticalAisles: [],
	horizontalAisles: [],
	invertRowOrder: false
};

/** Defensive parse of sector.metadata.aisles (unknown-shaped JSON). */
export function parseAisleMetadata(metadata: ChartSectorSchema['metadata']): AisleLayoutMetadata {
	const raw = metadata?.aisles;
	if (typeof raw !== 'object' || raw === null) return EMPTY_AISLES;
	const record = raw as Record<string, unknown>;
	const numbers = (value: unknown): number[] =>
		Array.isArray(value)
			? value.filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
			: [];
	return {
		verticalAisles: numbers(record.verticalAisles),
		horizontalAisles: numbers(record.horizontalAisles),
		invertRowOrder: record.invertRowOrder === true
	};
}

/** Number of aisle indices strictly below `limit` (each adds one unit of gap). */
function gapsBefore(aisles: number[], limit: number): number {
	return aisles.filter((index) => index >= 0 && index < limit).length;
}

function collate(a: string, b: string): number {
	return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Group seats into ordered rows, mirroring rowsFromSeatViews in seating-view.ts:
 * rows by (row_order, numeric-aware row_label), seats by (adjacency_index,
 * number, label).
 */
function orderedRows(seats: ChartSeatSchema[]): ChartSeatSchema[][] {
	const byLabel = new Map<string, ChartSeatSchema[]>();
	for (const seat of seats) {
		const label = seat.row_label ?? '?';
		const row = byLabel.get(label);
		if (row) {
			row.push(seat);
		} else {
			byLabel.set(label, [seat]);
		}
	}
	const rows = [...byLabel.entries()].map(([label, rowSeats]) => {
		rowSeats.sort(
			(a, b) =>
				(a.adjacency_index ?? 0) - (b.adjacency_index ?? 0) ||
				(a.number ?? 0) - (b.number ?? 0) ||
				collate(a.label, b.label)
		);
		return {
			label,
			order: Math.min(...rowSeats.map((seat) => seat.row_order ?? 0)),
			seats: rowSeats
		};
	});
	rows.sort((a, b) => a.order - b.order || collate(a.label, b.label));
	return rows.map((row) => row.seats);
}

/**
 * Column index per seat in a row: adjacency_index when unique within the row,
 * ordinal fallback otherwise (legacy rows where every adjacency_index is 0).
 */
function columnIndices(rowSeats: ChartSeatSchema[]): number[] {
	const adjacency = rowSeats.map((seat) => seat.adjacency_index ?? 0);
	const unique = new Set(adjacency).size === adjacency.length;
	return unique ? adjacency : rowSeats.map((_, index) => index);
}

/** Derive grid positions from row/adjacency ranks, honoring aisle metadata. */
function gridPoints(seats: ChartSeatSchema[], aisles: AisleLayoutMetadata): SeatPoint[] {
	const rows = orderedRows(seats);
	const yLogical = (rowIndex: number): number =>
		rowIndex + gapsBefore(aisles.horizontalAisles, rowIndex);
	const maxYLogical = rows.length > 0 ? yLogical(rows.length - 1) : 0;

	const points: SeatPoint[] = [];
	rows.forEach((rowSeats, rowIndex) => {
		const columns = columnIndices(rowSeats);
		const y = aisles.invertRowOrder ? maxYLogical - yLogical(rowIndex) : yLogical(rowIndex);
		rowSeats.forEach((seat, seatIndex) => {
			const column = columns[seatIndex];
			points.push({
				seatId: seat.id,
				label: seat.label,
				x: column + gapsBefore(aisles.verticalAisles, column),
				y
			});
		});
	});
	return points;
}

/**
 * Raw position passthrough: the stored coordinates, only when EVERY seat of
 * the sector has a position (not yet normalized).
 */
function rawPositions(seats: ChartSeatSchema[]): Coordinate2d[] | null {
	if (seats.length === 0) return null;
	const coords: Coordinate2d[] = [];
	for (const seat of seats) {
		if (!seat.position) return null;
		coords.push(seat.position);
	}
	return coords;
}

/** Normalize a shape polygon to its own bounding-box origin. */
function normalizeShape(shape: ChartSectorSchema['shape']): Coordinate2d[] | null {
	if (!shape || shape.length < 3) return null;
	const minX = Math.min(...shape.map((p) => p.x));
	const minY = Math.min(...shape.map((p) => p.y));
	return shape.map((p) => ({ x: p.x - minX, y: p.y - minY }));
}

function seatedSectorLayout(sector: ChartSectorSchema): SectorLayout | null {
	const active = (sector.seats ?? []).filter((seat) => seat.is_active !== false);
	const rawShape = sector.shape && sector.shape.length >= 3 ? sector.shape : null;
	const coords = rawPositions(active);

	let points: SeatPoint[];
	let shape: Coordinate2d[] | null;
	if (coords) {
		// Seats and shape live in ONE shared frame (the designer persists both
		// together): normalize with a single minimum over shape vertices ∪ seat
		// positions so their relative placement survives. Without a shape this
		// degenerates to the seats-only minimum.
		const frame: Coordinate2d[] = rawShape ? [...coords, ...rawShape] : coords;
		const minX = Math.min(...frame.map((p) => p.x));
		const minY = Math.min(...frame.map((p) => p.y));
		points = active.map((seat, index) => ({
			seatId: seat.id,
			label: seat.label,
			x: coords[index].x - minX,
			y: coords[index].y - minY
		}));
		shape = rawShape ? rawShape.map((p) => ({ x: p.x - minX, y: p.y - minY })) : null;
	} else {
		// Grid-derived seats have no stored frame to share — the shape can only
		// be normalized to its own bounding-box origin.
		points = gridPoints(active, parseAisleMetadata(sector.metadata));
		shape = normalizeShape(sector.shape);
	}
	if (points.length === 0 && !shape) return null;

	let width = points.length > 0 ? Math.max(...points.map((p) => p.x)) + 1 : 0;
	let height = points.length > 0 ? Math.max(...points.map((p) => p.y)) + 1 : 0;
	if (shape) {
		width = Math.max(width, ...shape.map((p) => p.x));
		height = Math.max(height, ...shape.map((p) => p.y));
	}
	return {
		id: sector.id,
		name: sector.name,
		kind: 'seated',
		shape,
		transform: { x: 0, y: 0, rotation: 0 },
		seats: points,
		width,
		height
	};
}

/**
 * Standing sectors: a seatless zone sized relative to capacity (~4 people per
 * unit², clamped to a sensible aspect), defaulting to 6×2 without a capacity.
 */
function standingSectorLayout(sector: ChartSectorSchema): SectorLayout {
	const capacity = sector.capacity ?? 0;
	let width = 6;
	let height = 2;
	if (capacity > 0) {
		const area = Math.max(capacity / 4, 2);
		width = Math.min(12, Math.max(4, Math.ceil(Math.sqrt(area * 2))));
		height = Math.max(2, Math.ceil(area / width));
	}
	return {
		id: sector.id,
		name: sector.name,
		kind: 'standing',
		shape: normalizeShape(sector.shape),
		transform: { x: 0, y: 0, rotation: 0 },
		seats: [],
		width,
		height
	};
}

/** World-space AABB of a sector's local [0,w]×[0,h] frame under its transform. */
export function worldBounds(laid: SectorLayout): {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
} {
	const corners: Coordinate2d[] = [
		{ x: 0, y: 0 },
		{ x: laid.width, y: 0 },
		{ x: laid.width, y: laid.height },
		{ x: 0, y: laid.height }
	].map((corner) => applyTransform(corner, laid.transform));
	const xs = corners.map((c) => c.x);
	const ys = corners.map((c) => c.y);
	return {
		minX: Math.min(...xs),
		minY: Math.min(...ys),
		maxX: Math.max(...xs),
		maxY: Math.max(...ys)
	};
}

/**
 * Full-chart layout: each sector is placed by its SectorTransform — a parsed
 * `metadata.transform`, or an implicit stacked transform reproducing today's
 * display_order stacking (name as a stable tiebreak, SECTOR_GAP between
 * boxes). Seated sectors without any renderable content (no active seats, no
 * shape) are skipped. The overall world bounding box (rotated sector AABBs
 * unioned) drives the viewBox; a chart with no explicit transforms is
 * byte-for-byte the old stacked layout.
 */
export function computeSeatMapLayout(chart: VenueChartSchema): SeatMapLayout {
	const ordered = [...(chart.sectors ?? [])].sort(
		(a, b) => (a.display_order ?? 0) - (b.display_order ?? 0) || collate(a.name, b.name)
	);

	const sectors: SectorLayout[] = [];
	// Cursor state for un-arranged (default-stacked) sectors only.
	let stackedIndex = 0;
	let stackedHeight = 0;
	for (const sector of ordered) {
		const laid =
			(sector.kind ?? 'seated') === 'standing'
				? standingSectorLayout(sector)
				: seatedSectorLayout(sector);
		if (!laid) continue;
		const parsed = parseSectorTransform(sector.metadata);
		if (parsed) {
			laid.transform = parsed;
		} else {
			laid.transform = defaultStackedTransform(stackedIndex, stackedHeight);
			stackedIndex += 1;
			stackedHeight += laid.height;
		}
		sectors.push(laid);
	}

	if (sectors.length === 0) {
		return { sectors, width: 0, height: 0, minX: 0, minY: 0, unit: 1 };
	}

	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const laid of sectors) {
		const bounds = worldBounds(laid);
		minX = Math.min(minX, bounds.minX);
		minY = Math.min(minY, bounds.minY);
		maxX = Math.max(maxX, bounds.maxX);
		maxY = Math.max(maxY, bounds.maxY);
	}
	return {
		sectors,
		width: maxX - minX,
		height: maxY - minY,
		minX,
		minY,
		unit: 1
	};
}
