/**
 * Pure geometry helpers for the freeform seat-map designer (no runes, no DOM).
 *
 * Everything works in layout units (1 unit = one seat cell, matching
 * seat-map-layout.ts). Kept free of Svelte imports so it stays unit-testable.
 */
import type { Coordinate2d } from '$lib/api/generated/types.gen';

/** A point with an id, used for marquee hit-testing and spatial navigation. */
export interface LabeledPoint {
	id: string;
	x: number;
	y: number;
}

/** Normalized axis-aligned rectangle. */
export interface Rect {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
}

const EPSILON = 1e-6;

/** Snap a value to the nearest multiple of `step`. */
export function snapValue(value: number, step = 0.5): number {
	if (step <= 0) return value;
	return Math.round(value / step) * step;
}

/** Rotation snap increment for the block arranger, in degrees. */
export const ROTATION_SNAP = 15;

/** Snap a rotation (degrees) to the nearest `step`°, normalized into [0, 360). */
export function snapAngle(deg: number, step = ROTATION_SNAP): number {
	if (step <= 0) return ((deg % 360) + 360) % 360;
	const snapped = Math.round(deg / step) * step;
	return ((snapped % 360) + 360) % 360;
}

/** Midpoint of two points (used to seed an edge-inserted shape vertex). */
export function midpoint(a: Coordinate2d, b: Coordinate2d): Coordinate2d {
	return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Insert `point` into `points` at `index` (clamped), returning a new array. */
export function insertVertex(
	points: readonly Coordinate2d[],
	index: number,
	point: Coordinate2d
): Coordinate2d[] {
	const clamped = Math.max(0, Math.min(index, points.length));
	return [...points.slice(0, clamped), point, ...points.slice(clamped)];
}

/** Remove the vertex at `index`, returning a new array (or null if <1 left). */
export function removeVertex(
	points: readonly Coordinate2d[],
	index: number
): Coordinate2d[] | null {
	const next = points.filter((_, i) => i !== index);
	return next.length > 0 ? next : null;
}

/** Snap a point to the grid. */
export function snapPoint(point: Coordinate2d, step = 0.5): Coordinate2d {
	return { x: snapValue(point.x, step), y: snapValue(point.y, step) };
}

/** Snap to the grid when `snapOn`, otherwise just round off float drift. */
export function snapOrRound(point: Coordinate2d, snapOn: boolean): Coordinate2d {
	return snapOn ? snapPoint(point) : { x: roundCoord(point.x), y: roundCoord(point.y) };
}

/** Round a persisted coordinate to 3 decimals (kills float drift, keeps 0.5 grid). */
export function roundCoord(value: number): number {
	return Math.round(value * 1000) / 1000;
}

/** Normalize two arbitrary corners into a Rect. */
export function rectFromCorners(a: Coordinate2d, b: Coordinate2d): Rect {
	return {
		minX: Math.min(a.x, b.x),
		minY: Math.min(a.y, b.y),
		maxX: Math.max(a.x, b.x),
		maxY: Math.max(a.y, b.y)
	};
}

/** Ids of points inside the rect (bounds inclusive, epsilon-tolerant). */
export function idsInRect(points: readonly LabeledPoint[], rect: Rect): string[] {
	return points
		.filter(
			(p) =>
				p.x >= rect.minX - EPSILON &&
				p.x <= rect.maxX + EPSILON &&
				p.y >= rect.minY - EPSILON &&
				p.y <= rect.maxY + EPSILON
		)
		.map((p) => p.id);
}

/**
 * Ray-casting point-in-polygon, mirroring the backend's
 * `events.schema.venue.point_in_polygon` exactly (including its asymmetric
 * boundary handling) so client-side pre-validation matches the 400s the
 * backend would produce on seat writes.
 */
export function pointInPolygon(point: Coordinate2d, polygon: readonly Coordinate2d[]): boolean {
	const n = polygon.length;
	if (n < 3) return false;
	const { x, y } = point;
	let inside = false;
	let p1x = polygon[0].x;
	let p1y = polygon[0].y;
	for (let i = 1; i <= n; i++) {
		const p2x = polygon[i % n].x;
		const p2y = polygon[i % n].y;
		if (
			y > Math.min(p1y, p2y) &&
			y <= Math.max(p1y, p2y) &&
			x <= Math.max(p1x, p2x) &&
			p1y !== p2y
		) {
			const xinters = ((y - p1y) * (p2x - p1x)) / (p2y - p1y) + p1x;
			if (p1x === p2x || x <= xinters) inside = !inside;
		}
		p1x = p2x;
		p1y = p2y;
	}
	return inside;
}

/**
 * A polygon the backend will accept: at least 3 finite vertices with no two
 * consecutive vertices coincident (closing edge included).
 */
export function polygonIsValid(points: readonly Coordinate2d[]): boolean {
	if (points.length < 3) return false;
	for (const p of points) {
		if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
	}
	for (let i = 0; i < points.length; i++) {
		const next = points[(i + 1) % points.length];
		if (pointsEqual(points[i], next)) return false;
	}
	return true;
}

/** Epsilon-tolerant point equality. */
export function pointsEqual(a: Coordinate2d, b: Coordinate2d, epsilon = EPSILON): boolean {
	return Math.abs(a.x - b.x) <= epsilon && Math.abs(a.y - b.y) <= epsilon;
}

/** Epsilon-tolerant shape equality (null = no shape). */
export function shapesEqual(
	a: readonly Coordinate2d[] | null,
	b: readonly Coordinate2d[] | null,
	epsilon = EPSILON
): boolean {
	if (a === null || b === null) return a === b;
	if (a.length !== b.length) return false;
	return a.every((p, i) => pointsEqual(p, b[i], epsilon));
}

export type Direction = 'left' | 'right' | 'up' | 'down';

const DIRECTION_VECTORS: Record<Direction, Coordinate2d> = {
	left: { x: -1, y: 0 },
	right: { x: 1, y: 0 },
	up: { x: 0, y: -1 },
	down: { x: 0, y: 1 }
};

/** Penalty factor for off-axis distance when picking the next focus target. */
const ORTHO_PENALTY = 2;

/**
 * Spatial focus navigation: the nearest point strictly in the given direction,
 * scored by on-axis distance plus a penalty for off-axis drift (so ArrowRight
 * prefers the seat in the same row over a closer one two rows down).
 */
export function nextSeatInDirection(
	points: readonly LabeledPoint[],
	fromId: string,
	direction: Direction
): string | null {
	const from = points.find((p) => p.id === fromId);
	if (!from) return null;
	const vec = DIRECTION_VECTORS[direction];
	let best: string | null = null;
	let bestScore = Infinity;
	for (const p of points) {
		if (p.id === fromId) continue;
		const dx = p.x - from.x;
		const dy = p.y - from.y;
		const axial = dx * vec.x + dy * vec.y;
		if (axial <= EPSILON) continue;
		const ortho = Math.abs(dx * vec.y) + Math.abs(dy * vec.x);
		const score = axial + ORTHO_PENALTY * ortho;
		if (score < bestScore) {
			bestScore = score;
			best = p.id;
		}
	}
	return best;
}

/**
 * Keyboard nudge step in units. Base step follows the snap grid (0.5) or a
 * fine step (0.1) when snapping is off; the modifier (Shift) quadruples it.
 */
export function nudgeStep(snapOn: boolean, large: boolean): number {
	const base = snapOn ? 0.5 : 0.1;
	return large ? base * 4 : base;
}

/** Arrow-key nudge delta for the given direction and step options. */
export function nudgeDelta(direction: Direction, snapOn: boolean, large: boolean): Coordinate2d {
	const step = nudgeStep(snapOn, large);
	const vec = DIRECTION_VECTORS[direction];
	return { x: vec.x * step, y: vec.y * step };
}
