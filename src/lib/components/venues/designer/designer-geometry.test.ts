import { describe, it, expect } from 'vitest';
import {
	idsInRect,
	nextSeatInDirection,
	nudgeDelta,
	nudgeStep,
	pointInPolygon,
	pointsEqual,
	polygonIsValid,
	rectFromCorners,
	roundCoord,
	shapesEqual,
	snapPoint,
	snapValue
} from './designer-geometry';

describe('snapValue / snapPoint', () => {
	it('snaps to the nearest 0.5 by default', () => {
		expect(snapValue(1.2)).toBe(1);
		expect(snapValue(1.3)).toBe(1.5);
		expect(snapValue(-0.4)).toBe(-0.5);
	});

	it('supports custom steps and ignores non-positive steps', () => {
		expect(snapValue(1.4, 1)).toBe(1);
		expect(snapValue(1.4, 0)).toBe(1.4);
	});

	it('snaps both axes of a point', () => {
		expect(snapPoint({ x: 0.7, y: 2.2 })).toEqual({ x: 0.5, y: 2 });
	});
});

describe('roundCoord', () => {
	it('rounds to 3 decimals (kills float drift, keeps the 0.5 grid)', () => {
		expect(roundCoord(0.1 + 0.2)).toBe(0.3);
		expect(roundCoord(1.5)).toBe(1.5);
	});
});

describe('rectFromCorners / idsInRect', () => {
	const points = [
		{ id: 'a', x: 0.5, y: 0.5 },
		{ id: 'b', x: 2, y: 2 },
		{ id: 'c', x: 5, y: 0.5 }
	];

	it('normalizes reversed corners', () => {
		expect(rectFromCorners({ x: 3, y: 3 }, { x: 0, y: 0 })).toEqual({
			minX: 0,
			minY: 0,
			maxX: 3,
			maxY: 3
		});
	});

	it('returns ids inside the rect, bounds inclusive', () => {
		const rect = rectFromCorners({ x: 0, y: 0 }, { x: 2, y: 2 });
		expect(idsInRect(points, rect)).toEqual(['a', 'b']);
	});

	it('returns nothing for a zero-area rect away from points', () => {
		const rect = rectFromCorners({ x: 3, y: 3 }, { x: 3, y: 3 });
		expect(idsInRect(points, rect)).toEqual([]);
	});
});

describe('pointInPolygon (backend ray-casting parity)', () => {
	const square = [
		{ x: 0, y: 0 },
		{ x: 4, y: 0 },
		{ x: 4, y: 4 },
		{ x: 0, y: 4 }
	];

	it('detects interior and exterior points', () => {
		expect(pointInPolygon({ x: 2, y: 2 }, square)).toBe(true);
		expect(pointInPolygon({ x: 5, y: 2 }, square)).toBe(false);
		expect(pointInPolygon({ x: -1, y: 2 }, square)).toBe(false);
	});

	it('mirrors the backend boundary asymmetry (top edge y=0 is outside)', () => {
		// Backend: `y > min(p1y, p2y)` excludes points on the minimal-y edge.
		expect(pointInPolygon({ x: 2, y: 0 }, square)).toBe(false);
		expect(pointInPolygon({ x: 2, y: 4 }, square)).toBe(true);
	});

	it('handles concave polygons', () => {
		const lShape = [
			{ x: 0, y: 0 },
			{ x: 4, y: 0 },
			{ x: 4, y: 2 },
			{ x: 2, y: 2 },
			{ x: 2, y: 4 },
			{ x: 0, y: 4 }
		];
		expect(pointInPolygon({ x: 1, y: 3 }, lShape)).toBe(true);
		expect(pointInPolygon({ x: 3, y: 3 }, lShape)).toBe(false);
	});

	it('returns false for degenerate polygons', () => {
		expect(pointInPolygon({ x: 0, y: 0 }, [{ x: 1, y: 1 }])).toBe(false);
	});
});

describe('polygonIsValid', () => {
	it('requires at least 3 vertices', () => {
		expect(
			polygonIsValid([
				{ x: 0, y: 0 },
				{ x: 1, y: 1 }
			])
		).toBe(false);
	});

	it('rejects consecutive duplicates, including the closing edge', () => {
		expect(
			polygonIsValid([
				{ x: 0, y: 0 },
				{ x: 0, y: 0 },
				{ x: 1, y: 1 }
			])
		).toBe(false);
		expect(
			polygonIsValid([
				{ x: 0, y: 0 },
				{ x: 1, y: 1 },
				{ x: 0, y: 0 }
			])
		).toBe(false);
	});

	it('rejects non-finite vertices and accepts a proper triangle', () => {
		expect(
			polygonIsValid([
				{ x: 0, y: 0 },
				{ x: NaN, y: 1 },
				{ x: 2, y: 2 }
			])
		).toBe(false);
		expect(
			polygonIsValid([
				{ x: 0, y: 0 },
				{ x: 2, y: 0 },
				{ x: 1, y: 2 }
			])
		).toBe(true);
	});
});

describe('pointsEqual / shapesEqual', () => {
	it('is epsilon-tolerant', () => {
		expect(pointsEqual({ x: 1, y: 1 }, { x: 1 + 1e-9, y: 1 })).toBe(true);
		expect(pointsEqual({ x: 1, y: 1 }, { x: 1.01, y: 1 })).toBe(false);
	});

	it('treats null as "no shape" and compares pointwise otherwise', () => {
		const tri = [
			{ x: 0, y: 0 },
			{ x: 1, y: 0 },
			{ x: 0, y: 1 }
		];
		expect(shapesEqual(null, null)).toBe(true);
		expect(shapesEqual(tri, null)).toBe(false);
		expect(shapesEqual(tri, [...tri])).toBe(true);
		expect(shapesEqual(tri, [tri[0], tri[1], { x: 0, y: 2 }])).toBe(false);
		expect(shapesEqual(tri, tri.slice(0, 2))).toBe(false);
	});
});

describe('nextSeatInDirection', () => {
	// Two rows of three seats (centers).
	const seats = [
		{ id: 'a1', x: 0.5, y: 0.5 },
		{ id: 'a2', x: 1.5, y: 0.5 },
		{ id: 'a3', x: 2.5, y: 0.5 },
		{ id: 'b1', x: 0.5, y: 1.5 },
		{ id: 'b2', x: 1.5, y: 1.5 }
	];

	it('prefers the same row over a closer seat in another row', () => {
		expect(nextSeatInDirection(seats, 'a1', 'right')).toBe('a2');
		expect(nextSeatInDirection(seats, 'a2', 'left')).toBe('a1');
	});

	it('moves between rows vertically', () => {
		expect(nextSeatInDirection(seats, 'a1', 'down')).toBe('b1');
		expect(nextSeatInDirection(seats, 'b2', 'up')).toBe('a2');
	});

	it('returns null at the boundary or for unknown ids', () => {
		expect(nextSeatInDirection(seats, 'a3', 'right')).toBe(null);
		expect(nextSeatInDirection(seats, 'missing', 'left')).toBe(null);
	});
});

describe('nudgeStep / nudgeDelta', () => {
	it('follows the snap grid with a 4x modifier', () => {
		expect(nudgeStep(true, false)).toBe(0.5);
		expect(nudgeStep(true, true)).toBe(2);
		expect(nudgeStep(false, false)).toBe(0.1);
		expect(nudgeStep(false, true)).toBeCloseTo(0.4);
	});

	it('produces directional deltas', () => {
		expect(nudgeDelta('left', true, false)).toEqual({ x: -0.5, y: 0 });
		expect(nudgeDelta('down', true, true)).toEqual({ x: 0, y: 2 });
	});
});
