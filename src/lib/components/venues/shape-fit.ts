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
	return points.every((point) => pointInPolygon(point, shape));
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

interface Vector2d {
	x: number;
	y: number;
}

/**
 * Outward unit normal of edge a→b. "Outward" is resolved against the hull
 * centroid rather than an assumed winding order (monotone chain here yields
 * one, but deriving it from the centroid is equally correct and doesn't
 * depend on that implementation detail holding).
 */
function outwardEdgeNormal(a: Coordinate2d, b: Coordinate2d, centroid: Vector2d): Vector2d {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const len = Math.hypot(dx, dy);
	if (len === 0) return { x: 0, y: 0 };
	// Perpendicular candidate; sign resolved below.
	let nx = dy / len;
	let ny = -dx / len;
	const mx = (a.x + b.x) / 2;
	const my = (a.y + b.y) / 2;
	if ((mx - centroid.x) * nx + (my - centroid.y) * ny < 0) {
		nx = -nx;
		ny = -ny;
	}
	return { x: nx, y: ny };
}

/**
 * Pad a convex polygon outward by `margin` units via per-vertex mitered
 * edge-normal offsets (Minkowski-sum-with-disk approximation), not centroid
 * scaling — centroid scaling only delivers `margin` clearance for near-regular
 * hulls; on an elongated hull (e.g. a shallow seat-row arc) the perpendicular
 * clearance from the long edges collapses toward zero.
 *
 * Each vertex moves along the bisector of its two adjacent outward edge
 * normals, by the miter length that puts both adjacent offset edges exactly
 * `margin` away from their source edges: for unit normals n1, n2 meeting at
 * angle θ, offset = margin·(n1+n2)/(1+n1·n2) — equivalent to
 * margin/cos(θ/2) along the bisector, derived from the half-angle identity
 * |n1+n2| = 2·cos(θ/2).
 *
 * At very sharp (near-180°) hull vertices this miter length blows up. Simply
 * *scaling down* the same vector to a cap is wrong: the bisector direction at
 * a needle tip is dominated by the tip's own axis, so shrinking it uniformly
 * drags the (already-correct) component along each adjacent edge's normal
 * down proportionally too — that under-pads the *edges*, i.e. exactly the bug
 * being fixed here, just relocated to the corner. So instead: whenever the
 * miter length would exceed `margin * 3`, bevel — emit the two edges' own
 * `margin`-offset endpoints (`p + margin·n1`, `p + margin·n2`) as separate
 * vertices, joined by a short straight cut, rather than one lunged-out point.
 * Each bevel endpoint sits at exactly `margin` from its own source edge by
 * construction, so neither adjacent edge's clearance is sacrificed to
 * satisfy the other; only the new cut segment itself (bounded, never a
 * spike) gets less than full clearance right at the original sharp tip —
 * an unavoidable trade-off for capping without unbounded spikes.
 */
function padOutward(hull: readonly Coordinate2d[], margin: number): Coordinate2d[] {
	const n = hull.length;
	const cx = hull.reduce((sum, p) => sum + p.x, 0) / n;
	const cy = hull.reduce((sum, p) => sum + p.y, 0) / n;
	const centroid: Vector2d = { x: cx, y: cy };
	const maxMiter = margin * 3;
	const result: Coordinate2d[] = [];
	for (let i = 0; i < n; i++) {
		const p = hull[i];
		const prev = hull[(i - 1 + n) % n];
		const next = hull[(i + 1) % n];
		const n1 = outwardEdgeNormal(prev, p, centroid);
		const n2 = outwardEdgeNormal(p, next, centroid);
		const dot = n1.x * n2.x + n1.y * n2.y;
		const denom = 1 + dot;
		if (denom > 1e-6) {
			const mx = (margin * (n1.x + n2.x)) / denom;
			const my = (margin * (n1.y + n2.y)) / denom;
			if (Math.hypot(mx, my) <= maxMiter) {
				result.push({ x: p.x + mx, y: p.y + my });
				continue;
			}
		}
		// Sharp corner (miter too long, or denom collapsed at a near-180° fold):
		// bevel instead of clamping the miter vector's length/direction.
		result.push({ x: p.x + margin * n1.x, y: p.y + margin * n1.y });
		result.push({ x: p.x + margin * n2.x, y: p.y + margin * n2.y });
	}
	return result;
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
