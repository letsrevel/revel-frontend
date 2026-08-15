import { describe, expect, it } from 'vitest';
import { CELL_PX, canvasFrame } from './seat-grid-layout';

describe('canvasFrame', () => {
	it('yields a 1x1 canvas for an empty grid', () => {
		expect(canvasFrame({ cells: [] })).toEqual({
			originX: 0,
			originY: 0,
			widthPx: CELL_PX,
			heightPx: CELL_PX
		});
	});

	it('bounds cells as unit squares and polygon vertices as bare points', () => {
		const frame = canvasFrame({
			cells: [
				{ x: 1, y: 2 },
				{ x: 3, y: 4 }
			],
			polygons: [[{ x: 0.5, y: 6 }], null]
		});
		expect(frame.originX).toBe(0.5);
		expect(frame.originY).toBe(2);
		// far edge: cell (3,4) owns through (4,5); vertex y=6 extends further down.
		expect(frame.widthPx).toBe((4 - 0.5) * CELL_PX);
		expect(frame.heightPx).toBe((6 - 2) * CELL_PX);
	});

	it('survives a cell count past the spread-argument limit', () => {
		// Math.min(...spread) overflows the stack around 65k arguments; the
		// frame must stay a plain loop so a huge lattice degrades, not crashes.
		const cells = Array.from({ length: 70_000 }, (_, i) => ({
			x: i % 300,
			y: Math.floor(i / 300)
		}));
		const frame = canvasFrame({ cells });
		expect(frame.originX).toBe(0);
		expect(frame.widthPx).toBe(300 * CELL_PX);
	});
});
