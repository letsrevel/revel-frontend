import { describe, expect, it } from 'vitest';
import type { Coordinate2d } from '$lib/api/generated/types.gen';
import { pointInPolygon } from './designer/designer-geometry';
import { autoFitShape, fitsWithinShape } from './shape-fit';

/** Shortest distance from `p` to the segment a-b. */
function pointToSegmentDistance(p: Coordinate2d, a: Coordinate2d, b: Coordinate2d): number {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const lengthSq = dx * dx + dy * dy;
	if (lengthSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
	const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq));
	return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Shortest distance from `p` to any edge of `polygon`. */
function minDistanceToPolygonEdges(p: Coordinate2d, polygon: readonly Coordinate2d[]): number {
	let min = Infinity;
	for (let i = 0; i < polygon.length; i++) {
		const a = polygon[i];
		const b = polygon[(i + 1) % polygon.length];
		min = Math.min(min, pointToSegmentDistance(p, a, b));
	}
	return min;
}

const square = [
	{ x: -1, y: -1 },
	{ x: 5, y: -1 },
	{ x: 5, y: 5 },
	{ x: -1, y: 5 }
];

describe('fitsWithinShape', () => {
	it('accepts points inside and rejects points outside', () => {
		expect(
			fitsWithinShape(
				[
					{ x: 0, y: 0 },
					{ x: 4, y: 4 }
				],
				square
			)
		).toBe(true);
		expect(
			fitsWithinShape(
				[
					{ x: 0, y: 0 },
					{ x: 9, y: 0 }
				],
				square
			)
		).toBe(false);
	});
});

describe('autoFitShape', () => {
	it('returns a polygon containing every input point', () => {
		const points = [
			{ x: 0, y: 0 },
			{ x: 6, y: 0.5 },
			{ x: 3, y: 4.2 },
			{ x: 1.5, y: 2 }
		];
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const shape = autoFitShape(points)!;
		expect(shape.length).toBeGreaterThanOrEqual(3);
		for (const point of points) expect(pointInPolygon(point, shape)).toBe(true);
	});

	it('handles a single collinear row (degenerate hull) via a padded rectangle', () => {
		const row = Array.from({ length: 8 }, (_, i) => ({ x: i, y: 2 }));
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const shape = autoFitShape(row)!;
		expect(shape.length).toBeGreaterThanOrEqual(4);
		for (const point of row) expect(pointInPolygon(point, shape)).toBe(true);
	});

	it('returns null for no points', () => {
		expect(autoFitShape([])).toBeNull();
	});

	it('a curved-row point cloud round-trips: autoFitShape output always fits', () => {
		const arc = Array.from({ length: 20 }, (_, i) => ({
			x: i * 0.7,
			y: Math.sin((i / 19) * Math.PI) * 3
		}));
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const shape = autoFitShape(arc)!;
		expect(fitsWithinShape(arc, shape)).toBe(true);
	});

	it('delivers real perpendicular clearance on a highly elongated hull (thin seat-row arc)', () => {
		// A smooth, closed 40:1 aspect-ratio hull (width 40, height 1),
		// densely sampled so no single vertex carries a pathologically sharp
		// turn. (A flat-base-plus-bump triangle — as one might first sketch a
		// "seat row" — has a genuine geometric cusp where the bump's tangent
		// meets the flat base; no bounded-cap offset algorithm can deliver
		// margin clearance exactly at that cusp without an unbounded spike,
		// so it isn't a fair probe of this fix. An elongated ellipse has no
		// such kink and is an equally valid stand-in for a curved seat row.)
		// Centroid-radial scaling collapses clearance on the long edges of a
		// hull like this toward zero; per-vertex edge-normal offsets must
		// hold close to the full margin instead.
		const semiMajor = 20;
		const semiMinor = 0.5;
		const sampleCount = 80;
		const points: Coordinate2d[] = Array.from({ length: sampleCount }, (_, i) => {
			const phi = (i / sampleCount) * 2 * Math.PI;
			return { x: semiMajor * Math.cos(phi), y: semiMinor * Math.sin(phi) };
		});
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const shape = autoFitShape(points, 0.75)!;
		for (const point of points) {
			expect(pointInPolygon(point, shape)).toBe(true);
		}
		const minClearance = Math.min(...points.map((p) => minDistanceToPolygonEdges(p, shape)));
		expect(minClearance).toBeGreaterThanOrEqual(0.5);
	});
});
