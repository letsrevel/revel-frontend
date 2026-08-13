// Pure generator -> baked pipeline: turns the editor's logical grid (cells +
// aisles) plus the rowLayout recipe into explicit per-seat positions. Every
// save persists these for EVERY seat, so the buyer map's raw-position
// passthrough always applies and no consumer ever needs the recipe.
//
// Frame contract: same as the legacy grid editor — the grid is physical space
// with the stage side at y = 0 (top). invertRowOrder affects only ranks and
// labels, never geometry, so it does not appear in any position formula (it
// only keys the row overrides, which are addressed by row_order rank).
import type { Coordinate2d } from '$lib/api/generated/types.gen';
import type { SeatData } from './seat-grid-types';
import type { RowLayoutRecipe, RowOverride } from './row-layout';
import { buildRowOrderLookup } from './seat-grid-save';

/**
 * Control-point sag per curve unit. curve=10 displaces the Bézier control
 * point by 4 units, i.e. the row's midpoint by ~2 seat pitches — comparable to
 * seats.io's curve×8 at their 20-unit pitch.
 */
export const CONTROL_SAG_PER_CURVE = 0.4;
const ARC_SAMPLES = 64;
const MIN_CURVED_ROW_SEATS = 3;

export interface BakeInput {
	cells: ReadonlyMap<string, SeatData>;
	verticalAisles: readonly number[];
	horizontalAisles: readonly number[];
	invertRowOrder: boolean;
	recipe: RowLayoutRecipe;
}

function aisleShift(aisles: readonly number[], index: number): number {
	let shift = 0;
	for (const aisle of aisles) if (aisle <= index) shift += 1;
	return shift;
}

function round3(value: number): number {
	return Math.round(value * 1000) / 1000;
}

function quadPoint(p0: Coordinate2d, c: Coordinate2d, p1: Coordinate2d, t: number): Coordinate2d {
	const u = 1 - t;
	return {
		x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x,
		y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y
	};
}

/** Map arc-length fractions to Bézier points via a sampled length table. */
function arcPoints(
	p0: Coordinate2d,
	c: Coordinate2d,
	p1: Coordinate2d,
	fractions: readonly number[]
): Coordinate2d[] {
	const samples: Coordinate2d[] = [];
	const lengths: number[] = [0];
	let total = 0;
	let previous = quadPoint(p0, c, p1, 0);
	samples.push(previous);
	for (let i = 1; i <= ARC_SAMPLES; i++) {
		const point = quadPoint(p0, c, p1, i / ARC_SAMPLES);
		total += Math.hypot(point.x - previous.x, point.y - previous.y);
		lengths.push(total);
		samples.push(point);
		previous = point;
	}
	return fractions.map((fraction) => {
		const target = fraction * total;
		let low = 0;
		let high = ARC_SAMPLES;
		while (low < high) {
			const mid = (low + high) >> 1;
			if (lengths[mid] < target) low = mid + 1;
			else high = mid;
		}
		if (low === 0) return samples[0];
		const t0 = (low - 1) / ARC_SAMPLES;
		const span = lengths[low] - lengths[low - 1];
		const within = span > 0 ? (target - lengths[low - 1]) / span : 0;
		return quadPoint(p0, c, p1, t0 + within / ARC_SAMPLES);
	});
}

export function bakeSeatPositions(input: BakeInput): Map<string, Coordinate2d> {
	const { recipe } = input;
	// 1. Collect populated cells per physical row.
	const colsByRow = new Map<number, number[]>();
	for (const [key, data] of input.cells) {
		if (!data.exists) continue;
		const [row, col] = key.split('-').map(Number);
		if (!Number.isInteger(row) || !Number.isInteger(col)) continue;
		const cols = colsByRow.get(row);
		if (cols) cols.push(col);
		else colsByRow.set(row, [col]);
	}
	// Sort rows once and carry each row's (sorted) cols alongside it, so later
	// steps consume the value captured here instead of re-querying the map
	// (which TypeScript can't know is still populated for the same keys).
	const rowEntries = [...colsByRow.entries()]
		.sort(([a], [b]) => a - b)
		.map(([row, cols]) => ({ row, cols: cols.sort((a, b) => a - b) }));
	const rows = rowEntries.map(({ row }) => row);
	const rankFor = buildRowOrderLookup(rows, input.invertRowOrder);
	const overrides = new Map<number, RowOverride>(
		recipe.rowOverrides.map((override) => [override.row, override])
	);

	// 2. Base x per seat and per-row widths (for alignment).
	const rowGeometry = rowEntries.map(({ row, cols }) => {
		const baseXs = cols.map((col) => col + aisleShift(input.verticalAisles, col));
		return { row, cols, baseXs };
	});
	const maxWidth = rowGeometry.reduce(
		(max, { baseXs }) => Math.max(max, baseXs[baseXs.length - 1] - baseXs[0]),
		0
	);

	// 3. Place each row.
	const positions = new Map<string, Coordinate2d>();
	for (const { row, cols, baseXs } of rowGeometry) {
		const first = baseXs[0];
		const width = baseXs[baseXs.length - 1] - first;
		const override = overrides.get(rankFor(row));

		const curve = override?.curve ?? recipe.curve;
		const stagger = override?.stagger ?? recipe.stagger;
		const alignShift =
			recipe.align === 'left'
				? 0
				: recipe.align === 'center'
					? (maxWidth - width) / 2
					: maxWidth - width;
		const shift = alignShift + (row % 2 === 1 ? stagger : 0) + (override?.dx ?? 0);
		const y = row + aisleShift(input.horizontalAisles, row) + (override?.dy ?? 0);

		if (curve === 0 || cols.length < MIN_CURVED_ROW_SEATS || width === 0) {
			cols.forEach((col, index) => {
				positions.set(`${row}-${col}`, { x: round3(baseXs[index] + shift), y: round3(y) });
			});
			continue;
		}

		const p0: Coordinate2d = { x: first + shift, y };
		const p1: Coordinate2d = { x: first + width + shift, y };
		const control: Coordinate2d = {
			x: first + width / 2 + shift,
			y: y + curve * CONTROL_SAG_PER_CURVE
		};
		// Seats keep their base-x fraction along the ARC (preserves aisle gaps).
		const fractions = baseXs.map((x) => (x - first) / width);
		const points = arcPoints(p0, control, p1, fractions);
		cols.forEach((col, index) => {
			positions.set(`${row}-${col}`, {
				x: round3(points[index].x),
				y: round3(points[index].y)
			});
		});
	}
	return positions;
}
