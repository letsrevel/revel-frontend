import { describe, expect, it } from 'vitest';
import { pointInPolygon } from './designer/designer-geometry';
import { autoFitShape, fitsWithinShape } from './shape-fit';

const square = [
	{ x: -1, y: -1 },
	{ x: 5, y: -1 },
	{ x: 5, y: 5 },
	{ x: -1, y: 5 }
];

describe('fitsWithinShape', () => {
	it('accepts points inside and rejects points outside', () => {
		expect(fitsWithinShape([{ x: 0, y: 0 }, { x: 4, y: 4 }], square)).toBe(true);
		expect(fitsWithinShape([{ x: 0, y: 0 }, { x: 9, y: 0 }], square)).toBe(false);
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
		const shape = autoFitShape(points)!;
		expect(shape.length).toBeGreaterThanOrEqual(3);
		for (const point of points) expect(pointInPolygon(point, shape)).toBe(true);
	});

	it('handles a single collinear row (degenerate hull) via a padded rectangle', () => {
		const row = Array.from({ length: 8 }, (_, i) => ({ x: i, y: 2 }));
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
		const shape = autoFitShape(arc)!;
		expect(fitsWithinShape(arc, shape)).toBe(true);
	});
});
