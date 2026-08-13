import { describe, expect, it } from 'vitest';
import type { SeatData } from './seat-grid-types';
import { defaultRowLayout } from './row-layout';
import { bakeSeatPositions, CONTROL_SAG_PER_CURVE, type BakeInput } from './seat-layout-bake';

const seat: SeatData = { exists: true, is_accessible: false, is_obstructed_view: false };

/** rows×cols full grid of cells. */
function grid(rows: number, cols: number): Map<string, SeatData> {
	const cells = new Map<string, SeatData>();
	for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.set(`${r}-${c}`, seat);
	return cells;
}

function bake(partial: Partial<BakeInput>): Map<string, { x: number; y: number }> {
	return bakeSeatPositions({
		cells: grid(3, 4),
		verticalAisles: [],
		horizontalAisles: [],
		invertRowOrder: false,
		recipe: defaultRowLayout(),
		...partial
	});
}

describe('bakeSeatPositions — golden identity', () => {
	it('default recipe reproduces the CORRECTED (buyer-map-fallback) grid positions exactly (integers)', () => {
		const positions = bake({ verticalAisles: [1], horizontalAisles: [0] });
		// An aisle is stored as the index it sits AFTER, so it must shift only
		// what comes STRICTLY AFTER it — matching `gapsBefore` in the buyer map's
		// position-less fallback (tickets/seat-map-layout.ts):
		//   x = col + count(vAisles < col), y = row + count(hAisles < row)
		// vAisles [1] ⇒ the gap opens between columns 1 and 2;
		// hAisles [0] ⇒ the gap opens between rows 0 and 1.
		//
		// NOTE: this is identity with that `<`-based fallback, NOT with bytes
		// the legacy grid editor actually persisted. The legacy editor's
		// getXPosition/getYPosition (`git show ab9ca829:.../SeatGridEditor.svelte`)
		// used `aisle <= index` and shipped that way since the grid editor's
		// introduction, so every position it wrote carries a one-slot-early
		// off-by-one relative to these expectations. This bake deliberately
		// departs from that persisted convention — see `aisleShift` in
		// seat-layout-bake.ts for the full rationale and disclosed consequence.
		expect(positions.get('0-0')).toEqual({ x: 0, y: 0 });
		expect(positions.get('0-1')).toEqual({ x: 1, y: 0 });
		expect(positions.get('0-2')).toEqual({ x: 3, y: 0 });
		expect(positions.get('0-3')).toEqual({ x: 4, y: 0 });
		expect(positions.get('1-0')).toEqual({ x: 0, y: 2 });
		expect(positions.get('2-2')).toEqual({ x: 3, y: 3 });
	});

	// Regression: an earlier draft of this bake used `aisle <= index`, which
	// shifted the aisle's own row/column too and so opened every gap one slot
	// EARLY — disagreeing with both the editor's aisle rails and the buyer
	// map's no-position fallback. The WYSIWYG grid draws these coordinates, so
	// the two derivations have to agree exactly.
	it('opens the aisle gap on the same side as the buyer map fallback', () => {
		const positions = bake({ verticalAisles: [2] });
		const xs = [0, 1, 2, 3].map((col) => positions.get(`0-${col}`)?.x);
		expect(xs).toEqual([0, 1, 2, 4]);
	});

	it('invertRowOrder does not change positions (ranks only)', () => {
		expect([...bake({ invertRowOrder: true })]).toEqual([...bake({})]);
	});
});

describe('bakeSeatPositions — stagger / align / overrides', () => {
	it('stagger shifts odd physical rows by the stagger value', () => {
		const positions = bake({ recipe: { ...defaultRowLayout(), stagger: 0.5 } });
		expect(positions.get('0-0')).toEqual({ x: 0, y: 0 });
		expect(positions.get('1-0')).toEqual({ x: 0.5, y: 1 });
		expect(positions.get('2-0')).toEqual({ x: 0, y: 2 });
	});

	it('center align centers narrow rows on the widest row', () => {
		const cells = grid(1, 6); // row 0: 6 seats, width 5
		for (let c = 0; c < 4; c++) cells.set(`1-${c}`, seat); // row 1: 4 seats, width 3
		const positions = bakeSeatPositions({
			cells,
			verticalAisles: [],
			horizontalAisles: [],
			invertRowOrder: false,
			recipe: { ...defaultRowLayout(), align: 'center' }
		});
		expect(positions.get('1-0')).toEqual({ x: 1, y: 1 }); // (5-3)/2 = 1
		expect(positions.get('0-0')).toEqual({ x: 0, y: 0 });
	});

	it('a row override wins over the sector default, keyed by row_order rank', () => {
		const positions = bake({
			recipe: { ...defaultRowLayout(), rowOverrides: [{ row: 1, dy: 0.5, dx: 2 }] }
		});
		expect(positions.get('1-0')).toEqual({ x: 2, y: 1.5 });
		expect(positions.get('0-0')).toEqual({ x: 0, y: 0 });
	});

	it('override ranks respect invertRowOrder (front row = rank 0 = bottom row)', () => {
		const positions = bake({
			invertRowOrder: true,
			recipe: { ...defaultRowLayout(), rowOverrides: [{ row: 0, dx: 3 }] }
		});
		// 3 rows, inverted: physical row 2 has rank 0.
		expect(positions.get('2-0')).toEqual({ x: 3, y: 2 });
		expect(positions.get('0-0')).toEqual({ x: 0, y: 0 });
	});
});

describe('bakeSeatPositions — curve', () => {
	it('curved row keeps chord endpoints pinned and sags the middle away from the stage', () => {
		const positions = bake({ cells: grid(1, 5), recipe: { ...defaultRowLayout(), curve: 10 } });
		expect(positions.get('0-0')).toEqual({ x: 0, y: 0 });
		expect(positions.get('0-4')).toEqual({ x: 4, y: 0 });
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const mid = positions.get('0-2')!;
		expect(mid.y).toBeGreaterThan(0.5); // sags downward (+y = away from stage)
		expect(mid.y).toBeLessThanOrEqual(10 * CONTROL_SAG_PER_CURVE);
		expect(mid.x).toBeCloseTo(2, 1);
	});

	it('negative curve bows toward the stage', () => {
		const positions = bake({ cells: grid(1, 5), recipe: { ...defaultRowLayout(), curve: -10 } });
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		expect(positions.get('0-2')!.y).toBeLessThan(-0.5);
	});

	it('arc-length distribution keeps neighbor spacing uniform on a full row', () => {
		const positions = bakeSeatPositions({
			cells: grid(1, 9),
			verticalAisles: [],
			horizontalAisles: [],
			invertRowOrder: false,
			recipe: { ...defaultRowLayout(), curve: 20 }
		});
		const pts = Array.from({ length: 9 }, (_, i) => {
			const point = positions.get(`0-${i}`);
			expect(point).toBeDefined();
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			return point!;
		});
		const gaps = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y));
		const min = Math.min(...gaps);
		const max = Math.max(...gaps);
		expect(max / min).toBeLessThan(1.05); // within 5% — equal-t would fail this
	});

	it('rows with fewer than 3 seats never curve', () => {
		const cells = new Map<string, SeatData>([
			['0-0', seat],
			['0-1', seat]
		]);
		const positions = bakeSeatPositions({
			cells,
			verticalAisles: [],
			horizontalAisles: [],
			invertRowOrder: false,
			recipe: { ...defaultRowLayout(), curve: 20 }
		});
		expect(positions.get('0-0')).toEqual({ x: 0, y: 0 });
		expect(positions.get('0-1')).toEqual({ x: 1, y: 0 });
	});

	it('all outputs are rounded to 3 decimals', () => {
		const positions = bake({ cells: grid(1, 7), recipe: { ...defaultRowLayout(), curve: 7.4 } });
		for (const point of positions.values()) {
			expect(point.x).toBe(Math.round(point.x * 1000) / 1000);
			expect(point.y).toBe(Math.round(point.y * 1000) / 1000);
		}
	});
});
