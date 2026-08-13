import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import type { Coordinate2d } from '$lib/api/generated/types.gen';
import type { SeatData } from './seat-grid-types';
import { defaultRowLayout, type RowLayoutRecipe } from './row-layout';
import { bakeSeatPositions } from './seat-layout-bake';
import { BUTTON_PX, CELL_PX, syntheticCells } from './seat-grid-layout';
import SeatGrid from './SeatGrid.svelte';

const ROWS = 3;
const COLUMNS = 5;

interface Options {
	recipe?: RowLayoutRecipe;
	invertRowOrder?: boolean;
	verticalAisles?: number[];
	horizontalAisles?: number[];
	shape?: Coordinate2d[] | null;
	proposedShape?: Coordinate2d[] | null;
	rows?: number;
	columns?: number;
}

function props(options: Options = {}) {
	const {
		recipe = defaultRowLayout(),
		invertRowOrder = false,
		verticalAisles = [],
		horizontalAisles = [],
		shape = null,
		proposedShape = null,
		rows = ROWS,
		columns = COLUMNS
	} = options;

	const cells = syntheticCells(rows, columns);
	const seats = new SvelteMap<string, SeatData>(cells);
	// The editor feeds SeatGrid the DISPLAY map (real bake for seats, synthetic
	// lattice for empty cells). Every cell holds a seat here, so one bake is both.
	const positions = bakeSeatPositions({
		cells,
		verticalAisles,
		horizontalAisles,
		invertRowOrder,
		recipe
	});

	return {
		seats,
		selectedCells: new SvelteSet<string>(),
		verticalAisles: new SvelteSet<number>(verticalAisles),
		horizontalAisles: new SvelteSet<number>(horizontalAisles),
		rows,
		columns,
		invertRowOrder,
		getRowLabel: (index: number) => String.fromCharCode(65 + index),
		getSeatLabel: (row: number, col: number) => `${String.fromCharCode(65 + row)}${col + 1}`,
		getCellKey: (row: number, col: number) => `${row}-${col}`,
		positions,
		shape,
		proposedShape
	};
}

const cellStyle = (container: HTMLElement, key: string) => {
	const button = container.querySelector<HTMLElement>(`[data-cell="${key}"]`);
	if (!button) throw new Error(`no cell ${key}`);
	return { left: parseFloat(button.style.left), top: parseFloat(button.style.top) };
};

describe('SeatGrid — geometry-aware editing surface', () => {
	it('renders one absolutely positioned button per logical cell', () => {
		const { container } = render(SeatGrid, props());
		expect(container.querySelectorAll('[data-cell]')).toHaveLength(ROWS * COLUMNS);
		const a1 = container.querySelector<HTMLElement>('[data-cell="0-0"]');
		expect(a1?.className).toContain('absolute');
		expect(a1?.style.width).toBe(`${BUTTON_PX}px`);
	});

	it('a straight recipe lays the cells out on a regular lattice', () => {
		const { container } = render(SeatGrid, props());
		const a1 = cellStyle(container, '0-0');
		const a2 = cellStyle(container, '0-1');
		const b1 = cellStyle(container, '1-0');

		// One cell pitch apart on each axis, and rows are flat.
		expect(a2.left - a1.left).toBeCloseTo(CELL_PX, 5);
		expect(a2.top).toBeCloseTo(a1.top, 5);
		expect(b1.top - a1.top).toBeCloseTo(CELL_PX, 5);
		expect(b1.left).toBeCloseTo(a1.left, 5);
	});

	it('a curved recipe bends the row in the grid itself (WYSIWYG)', () => {
		const { container } = render(SeatGrid, props({ recipe: { ...defaultRowLayout(), curve: 12 } }));
		const ends = [cellStyle(container, '0-0').top, cellStyle(container, '0-4').top];
		const middle = cellStyle(container, '0-2').top;

		// Row endpoints stay level; the middle sags away from the stage.
		expect(ends[0]).toBeCloseTo(ends[1], 5);
		expect(middle).toBeGreaterThan(ends[0]);
	});

	it('an aisle opens a full cell gap AFTER the stored column, and marks it', () => {
		// verticalAisles [1] = "aisle after column index 1", i.e. between the
		// 2nd and 3rd seat of every row.
		const { container } = render(SeatGrid, props({ verticalAisles: [1] }));
		const lefts = [0, 1, 2, 3, 4].map((c) => cellStyle(container, `0-${c}`).left);
		expect(lefts[1] - lefts[0]).toBeCloseTo(CELL_PX, 5);
		expect(lefts[2] - lefts[1]).toBeCloseTo(CELL_PX * 2, 5);
		expect(lefts[3] - lefts[2]).toBeCloseTo(CELL_PX, 5);
		expect(container.querySelectorAll('[data-testid="seat-grid-aisle-band"]')).toHaveLength(1);
	});

	it('renders the sector outline and the proposed outline as an underlay', () => {
		const shape = [
			{ x: -0.5, y: -0.5 },
			{ x: 4.5, y: -0.5 },
			{ x: 4.5, y: 2.5 }
		];
		const { container } = render(SeatGrid, props({ shape, proposedShape: shape }));
		const outline = container.querySelector('[data-testid="seat-grid-shape"]');
		expect(outline).toBeTruthy();
		expect(container.querySelector('[data-testid="seat-grid-proposed-shape"]')).toBeTruthy();
		// Same frame as the buttons: origin is the min over cells AND vertices,
		// so the outline's first vertex lands at pixel 0 on both axes here.
		expect(outline?.getAttribute('points')?.split(' ')[0]).toBe('0,0');
	});

	it('keeps the accessible seat label and the logical row labels', () => {
		const { container, getByLabelText, getByText } = render(SeatGrid, props());
		expect(getByLabelText('Seat A1')).toBeTruthy();
		expect(getByLabelText('Seat C5')).toBeTruthy();
		expect(getByText('C')).toBeTruthy();
		expect(container.querySelector('[data-cell="2-4"]')).toBeTruthy();
	});
});

describe('SeatGrid — stage side', () => {
	const stageBeforeCanvas = (container: HTMLElement): boolean => {
		const stage = container.querySelector('[data-testid="seat-grid-stage"]');
		const canvas = container.querySelector('[data-testid="seat-grid-canvas"]');
		if (!stage || !canvas) throw new Error('missing stage or canvas');
		return Boolean(canvas.compareDocumentPosition(stage) & Node.DOCUMENT_POSITION_PRECEDING);
	};

	it('puts the stage above the seats for a normal sector', () => {
		const { container } = render(SeatGrid, props());
		expect(stageBeforeCanvas(container)).toBe(true);
	});

	it('moves the stage below the seats for an inverted sector', () => {
		const { container } = render(SeatGrid, props({ invertRowOrder: true }));
		expect(stageBeforeCanvas(container)).toBe(false);
	});

	it('never flips the cells themselves — only the stage bar moves', () => {
		const tops = (invertRowOrder: boolean) => {
			const { container } = render(SeatGrid, props({ invertRowOrder }));
			return [0, 1, 2].map((r) => cellStyle(container, `${r}-0`).top);
		};
		expect(tops(true)).toEqual(tops(false));
	});

	it('keeps each row label on its own physical row under inversion', () => {
		const { container } = render(SeatGrid, props({ invertRowOrder: true }));
		// Row A is still drawn at the smallest y; the stage moved to the bottom,
		// so A is the row FURTHEST from the stage — rank order is unchanged.
		expect(cellStyle(container, '0-0').top).toBeLessThan(cellStyle(container, '2-0').top);
	});
});
