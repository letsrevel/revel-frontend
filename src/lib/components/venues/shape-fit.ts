// Sector-outline helpers for the always-bake pipeline: the backend rejects
// seats outside sector.shape, so when new baked geometry violates an existing
// outline the editor offers a regenerated one (padded convex hull) or clearing
// it. Coordinates stay in the seats' persisted frame — the backend validates
// raw values of both, so hull-of-seats is frame-consistent by construction.
import type { Coordinate2d } from '$lib/api/generated/types.gen';
import { pointInPolygon } from './designer/designer-geometry';

const DEFAULT_MARGIN = 0.75;

export function fitsWithinShape(
	points: readonly Coordinate2d[],
	shape: readonly Coordinate2d[]
): boolean {
	return points.every((point) => pointInPolygon(point, [...shape]));
}

function cross(o: Coordinate2d, a: Coordinate2d, b: Coordinate2d): number {
	return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/** Monotone-chain convex hull; returns fewer than 3 points when degenerate. */
function convexHull(points: readonly Coordinate2d[]): Coordinate2d[] {
	const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
	const unique = sorted.filter(
		(p, i) => i === 0 || p.x !== sorted[i - 1].x || p.y !== sorted[i - 1].y
	);
	if (unique.length < 3) return unique;
	const lower: Coordinate2d[] = [];
	for (const p of unique) {
		while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
			lower.pop();
		lower.push(p);
	}
	const upper: Coordinate2d[] = [];
	for (const p of [...unique].reverse()) {
		while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
			upper.pop();
		upper.push(p);
	}
	return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** Pad a convex polygon outward from its centroid by `margin` units. */
function padOutward(hull: readonly Coordinate2d[], margin: number): Coordinate2d[] {
	const cx = hull.reduce((sum, p) => sum + p.x, 0) / hull.length;
	const cy = hull.reduce((sum, p) => sum + p.y, 0) / hull.length;
	return hull.map((p) => {
		const dx = p.x - cx;
		const dy = p.y - cy;
		const length = Math.hypot(dx, dy);
		if (length === 0) return { x: p.x + margin, y: p.y };
		const scale = (length + margin) / length;
		return { x: cx + dx * scale, y: cy + dy * scale };
	});
}

export function autoFitShape(
	points: readonly Coordinate2d[],
	margin: number = DEFAULT_MARGIN
): Coordinate2d[] | null {
	if (points.length === 0) return null;
	const hull = convexHull(points);
	if (hull.length >= 3) return padOutward(hull, margin);
	// Degenerate (single point / collinear row): padded axis-aligned rectangle.
	const xs = points.map((p) => p.x);
	const ys = points.map((p) => p.y);
	const minX = Math.min(...xs) - margin;
	const maxX = Math.max(...xs) + margin;
	const minY = Math.min(...ys) - margin;
	const maxY = Math.max(...ys) + margin;
	return [
		{ x: minX, y: minY },
		{ x: maxX, y: minY },
		{ x: maxX, y: maxY },
		{ x: minX, y: maxY }
	];
}
