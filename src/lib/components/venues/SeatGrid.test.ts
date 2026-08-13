import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { tick } from 'svelte';
import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import type { Coordinate2d } from '$lib/api/generated/types.gen';
import type { SeatData } from './seat-grid-types';
import { defaultRowLayout, type RowLayoutRecipe } from './row-layout';
import { bakeSeatPositions } from './seat-layout-bake';
import { BUTTON_PX, CELL_PX, syntheticCells } from './seat-grid-layout';
import { SeatAdjustState } from './seat-adjust-state.svelte';
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

describe('SeatGrid — adjust mode', () => {
	interface AdjustHarness {
		adjust: SeatAdjustState;
		nudges: Array<{ row: number; col: number; dx: number; dy: number; coarse: boolean }>;
		addedRows: number[];
		addedPoints: Coordinate2d[];
		edits: Array<string | undefined>;
	}

	function adjustProps(options: Options & { active?: boolean; addArmed?: boolean } = {}) {
		const adjust = new SeatAdjustState();
		if (options.active ?? true) adjust.setActive(true);
		if (options.addArmed) adjust.setAddArmed(true);
		const harness: AdjustHarness = {
			adjust,
			nudges: [],
			addedRows: [],
			addedPoints: [],
			edits: []
		};
		return {
			props: {
				...props(options),
				adjust,
				onNudgeSeat: (
					row: number,
					col: number,
					delta: { dx: number; dy: number },
					coarse: boolean
				) => harness.nudges.push({ row, col, dx: delta.dx, dy: delta.dy, coarse }),
				onAddSeatToRow: (row: number) => harness.addedRows.push(row),
				onAddSeatAt: (point: Coordinate2d) => harness.addedPoints.push(point),
				onBeforeEdit: (key?: string) => harness.edits.push(key)
			},
			harness
		};
	}

	const cell = (container: HTMLElement, key: string): HTMLElement => {
		const button = container.querySelector<HTMLElement>(`[data-cell="${key}"]`);
		if (!button) throw new Error(`no cell ${key}`);
		return button;
	};

	it('gates selection: a click only selects a seat while the mode is ON', async () => {
		const user = userEvent.setup();
		const off = adjustProps({ active: false });
		const { container } = render(SeatGrid, off.props);
		await user.click(cell(container, '1-2'));
		expect(off.harness.adjust.selected).toBeNull();

		const on = adjustProps();
		const second = render(SeatGrid, on.props);
		await user.click(cell(second.container, '1-2'));
		expect(on.harness.adjust.selected).toEqual({ row: 1, col: 2 });
	});

	it('a click in adjust mode never toggles or paints the cell', async () => {
		const user = userEvent.setup();
		const { props: adjusted, harness } = adjustProps();
		const { container } = render(SeatGrid, adjusted);
		await user.click(cell(container, '0-0'));
		// The cell map is untouched — no seat removed, no history entry.
		expect(adjusted.seats.get('0-0')?.exists).toBe(true);
		expect(harness.edits).toEqual([]);
	});

	it('gates dragging: pointer moves only nudge while the mode is ON', () => {
		const off = adjustProps({ active: false });
		const first = render(SeatGrid, off.props);
		const target = cell(first.container, '0-1');
		target.dispatchEvent(
			new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 0, clientY: 0 })
		);
		target.dispatchEvent(
			new PointerEvent('pointermove', { bubbles: true, clientX: 48, clientY: 0 })
		);
		target.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 48, clientY: 0 }));
		expect(off.harness.nudges).toEqual([]);

		const on = adjustProps();
		const second = render(SeatGrid, on.props);
		const draggable = cell(second.container, '0-1');
		draggable.dispatchEvent(
			new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 0, clientY: 0 })
		);
		draggable.dispatchEvent(
			new PointerEvent('pointermove', { bubbles: true, clientX: 24, clientY: -48 })
		);
		draggable.dispatchEvent(
			new PointerEvent('pointerup', { bubbles: true, clientX: 24, clientY: -48 })
		);
		// 24px / 48px per pitch = half a seat right, one full row up.
		expect(on.harness.nudges).toEqual([{ row: 0, col: 1, dx: 0.5, dy: -1, coarse: false }]);
		// Exactly ONE undo entry for the whole gesture.
		expect(on.harness.edits).toEqual([undefined]);
	});

	it('moves the dragged button live, before anything is committed', async () => {
		const { props: adjusted } = adjustProps();
		const { container } = render(SeatGrid, adjusted);
		const target = cell(container, '0-1');
		const before = parseFloat(target.style.left);
		target.dispatchEvent(
			new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 0, clientY: 0 })
		);
		target.dispatchEvent(
			new PointerEvent('pointermove', { bubbles: true, clientX: 30, clientY: 0 })
		);
		await tick();
		expect(parseFloat(cell(container, '0-1').style.left)).toBeCloseTo(before + 30, 5);
	});

	it('nudges with the arrow keys, coarsely with Shift, and coalesces the burst', async () => {
		const user = userEvent.setup();
		const { props: adjusted, harness } = adjustProps();
		const { container } = render(SeatGrid, adjusted);
		const target = cell(container, '2-3');
		target.focus();

		await user.keyboard('{ArrowRight}');
		await user.keyboard('{Shift>}{ArrowUp}{/Shift}');

		expect(harness.nudges).toEqual([
			{ row: 2, col: 3, dx: 0.1, dy: 0, coarse: false },
			{ row: 2, col: 3, dx: 0, dy: -0.5, coarse: true }
		]);
		// Selection follows the keyboard, and the burst is coalescible.
		expect(harness.adjust.selected).toEqual({ row: 2, col: 3 });
		expect(harness.edits).toEqual(['nudge', 'nudge']);
	});

	it('ignores arrow keys entirely while the mode is off', async () => {
		const user = userEvent.setup();
		const { props: adjusted, harness } = adjustProps({ active: false });
		const { container } = render(SeatGrid, adjusted);
		cell(container, '2-3').focus();
		await user.keyboard('{ArrowRight}');
		expect(harness.nudges).toEqual([]);
	});

	it('offers a keyboard-reachable "add seat" button per row, at the row end', async () => {
		const user = userEvent.setup();
		const { props: adjusted, harness } = adjustProps();
		const { container, getByLabelText } = render(SeatGrid, adjusted);
		expect(container.querySelectorAll('[data-testid="seat-grid-add-to-row"]')).toHaveLength(ROWS);

		const rowB = getByLabelText('Add a seat to row B');
		expect(rowB.tagName).toBe('BUTTON');
		await user.click(rowB);
		expect(harness.addedRows).toEqual([1]);
		expect(harness.edits).toEqual([undefined]);
	});

	it('arms "add anywhere" only in adjust mode, and reports the clicked point', async () => {
		const user = userEvent.setup();
		const unarmed = render(SeatGrid, adjustProps().props);
		expect(unarmed.container.querySelector('[data-testid="seat-grid-add-anywhere"]')).toBeNull();

		const { props: adjusted, harness } = adjustProps({ addArmed: true });
		const { container } = render(SeatGrid, adjusted);
		const target = container.querySelector<HTMLElement>('[data-testid="seat-grid-add-anywhere"]');
		if (!target) throw new Error('no add-anywhere target');
		// jsdom reports a zero-size box, so the click resolves against origin 0.
		await user.click(target);
		expect(harness.addedPoints).toHaveLength(1);
		expect(harness.edits).toEqual([undefined]);
	});
});

describe('SeatGrid — abandoning a drag', () => {
	function adjustHarness() {
		const adjust = new SeatAdjustState();
		adjust.setActive(true);
		const nudges: unknown[] = [];
		const edits: Array<string | undefined> = [];
		const base = props();
		return {
			adjust,
			nudges,
			edits,
			seats: base.seats,
			selectedCells: base.selectedCells,
			props: {
				...base,
				adjust,
				onNudgeSeat: (...args: unknown[]) => nudges.push(args),
				onBeforeEdit: (key?: string) => edits.push(key)
			}
		};
	}

	it('leaving the mode mid-drag commits nothing and swallows the trailing click', async () => {
		const harness = adjustHarness();
		const { container } = render(SeatGrid, harness.props);
		const target = container.querySelector<HTMLElement>('[data-cell="0-1"]');
		if (!target) throw new Error('no cell');

		target.dispatchEvent(
			new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 0, clientY: 0 })
		);
		target.dispatchEvent(
			new PointerEvent('pointermove', { bubbles: true, clientX: 48, clientY: 0 })
		);
		await tick();
		const moved = target.style.left;

		// Escape (the editor's window handler calls exactly this).
		harness.adjust.setActive(false);
		await tick();

		// The button snapped back — the drag was abandoned, not committed.
		expect(container.querySelector<HTMLElement>('[data-cell="0-1"]')?.style.left).not.toBe(moved);

		// The release, and the click the browser synthesizes after it, are inert:
		// no nudge, no history entry, and no fall-through to the normal-mode
		// toggle/select branch.
		target.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 48, clientY: 0 }));
		target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await tick();

		expect(harness.nudges).toEqual([]);
		expect(harness.edits).toEqual([]);
		expect(harness.selectedCells.size).toBe(0);
		expect(harness.seats.get('0-1')?.exists).toBe(true);
	});

	it('a pointermove after leaving the mode cannot revive the drag', async () => {
		const harness = adjustHarness();
		const { container } = render(SeatGrid, harness.props);
		const target = container.querySelector<HTMLElement>('[data-cell="0-1"]');
		if (!target) throw new Error('no cell');
		const home = target.style.left;

		target.dispatchEvent(
			new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 0, clientY: 0 })
		);
		harness.adjust.setActive(false);
		await tick();
		target.dispatchEvent(
			new PointerEvent('pointermove', { bubbles: true, clientX: 90, clientY: 0 })
		);
		await tick();

		expect(harness.adjust.drag).toBeNull();
		expect(container.querySelector<HTMLElement>('[data-cell="0-1"]')?.style.left).toBe(home);
	});

	// Rotation is VISIBLE here exactly as it is on the buyer's map: the same
	// seat-rotation.ts geometry, drawn on the seats that carry a non-zero `rot`
	// and on no others.
	describe('rotation notch', () => {
		const notchIn = (container: HTMLElement, key: string) =>
			container.querySelector<SVGSVGElement>(
				`[data-cell="${key}"] [data-testid="seat-rotation-notch"]`
			);

		it('draws no notch when nothing is rotated', () => {
			const { container } = render(SeatGrid, props());
			expect(container.querySelectorAll('[data-testid="seat-rotation-notch"]')).toHaveLength(0);
		});

		it('draws a notch on the rotated seat only', () => {
			const rotations = new Map([['0-1', 90]]);
			const { container } = render(SeatGrid, {
				...props(),
				rotationFor: (row: number, col: number) => rotations.get(`${row}-${col}`) ?? 0
			});
			expect(container.querySelectorAll('[data-testid="seat-rotation-notch"]')).toHaveLength(1);
			expect(notchIn(container, '0-1')?.dataset.rot).toBe('90');
			expect(notchIn(container, '0-0')).toBeNull();
		});

		it('turns the notch with the value, clockwise from up', async () => {
			const base = props();
			const line = (container: HTMLElement) =>
				container.querySelector<SVGLineElement>(
					'[data-cell="0-1"] [data-testid="seat-rotation-notch"] line'
				);
			const rotate = (deg: number) => ({
				...base,
				rotationFor: (row: number, col: number) => (row === 0 && col === 1 ? deg : 0)
			});
			const { container, rerender } = render(SeatGrid, rotate(0));
			expect(line(container)).toBeNull();

			const center = BUTTON_PX / 2;
			await rerender(rotate(0));
			await rerender(rotate(90));
			const right = line(container);
			if (!right) throw new Error('no notch line');
			// 90° points right: the stroke runs out along +x at the seat's midline.
			expect(Number(right.getAttribute('x2'))).toBeGreaterThan(center);
			expect(Number(right.getAttribute('y2'))).toBeCloseTo(center, 6);

			// -90° is its mirror image, and 0 puts the notch back to plain "up".
			await rerender(rotate(-90));
			const left = line(container);
			expect(Number(left?.getAttribute('x2'))).toBeLessThan(center);

			await rerender(rotate(0));
			expect(line(container)).toBeNull();
		});
	});
});
