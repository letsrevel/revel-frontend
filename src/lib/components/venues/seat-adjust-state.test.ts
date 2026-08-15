import { describe, expect, it } from 'vitest';
import { SvelteMap } from 'svelte/reactivity';
import type { SeatData } from './seat-grid-types';
import {
	ROW_SHIFT_LIMIT,
	defaultRowLayout,
	parseRowLayout,
	serializeRowLayout
} from './row-layout';
import { bakeSeatPositions } from './seat-layout-bake';
import {
	NUDGE_COARSE_STEP,
	SeatAdjustState,
	clearNudge,
	findNudge,
	growColumns,
	mirrorRowRanks,
	nearestRowIndex,
	nextColumnInRow,
	normalizeRotationInput,
	remapNudgeRanks,
	SeatDragController,
	snapNudge,
	upsertNudge
} from './seat-adjust-state.svelte';

const seat = (): SeatData => ({
	exists: true,
	is_accessible: false,
	is_obstructed_view: false
});

function cellMap(keys: string[]): SvelteMap<string, SeatData> {
	return new SvelteMap(keys.map((key) => [key, seat()]));
}

describe('snapNudge', () => {
	it('rounds free drags to a tenth of a seat pitch', () => {
		expect(snapNudge(0.34)).toBe(0.3);
		expect(snapNudge(0.36)).toBe(0.4);
		expect(snapNudge(-1.23)).toBe(-1.2);
	});

	it('snaps to half a seat pitch when coarse (Shift)', () => {
		expect(snapNudge(0.34, true)).toBe(0.5);
		expect(snapNudge(0.7, true)).toBe(0.5);
		expect(snapNudge(0.8, true)).toBe(1);
		expect(snapNudge(-0.3, true)).toBe(-0.5);
		expect(snapNudge(1.2, true) % NUDGE_COARSE_STEP).toBe(0);
	});

	it('clamps to the persisted shift limit and never yields -0', () => {
		expect(snapNudge(999)).toBe(ROW_SHIFT_LIMIT);
		expect(snapNudge(-999)).toBe(-ROW_SHIFT_LIMIT);
		expect(Object.is(snapNudge(-0.01), 0)).toBe(true);
	});

	it('keeps values free of binary-float noise (they get persisted)', () => {
		// 0.1 + 0.2 style drift would serialize as 0.30000000000000004.
		expect(snapNudge(0.1 * 3)).toBe(0.3);
		expect(String(snapNudge(2.7000000000000006))).toBe('2.7');
	});
});

describe('normalizeRotationInput', () => {
	it('wraps into [-180, 180) exactly like the persistence parser', () => {
		expect(normalizeRotationInput(0)).toBe(0);
		expect(normalizeRotationInput(90)).toBe(90);
		expect(normalizeRotationInput(200)).toBe(-160);
		expect(normalizeRotationInput(180)).toBe(-180);
		expect(normalizeRotationInput(-180)).toBe(-180);
		expect(normalizeRotationInput(-200)).toBe(160);
		expect(normalizeRotationInput(360)).toBe(0);
	});
});

describe('upsertNudge — one nudge per seat, replace never append', () => {
	it('writes a new nudge', () => {
		const recipe = upsertNudge(defaultRowLayout(), 0, 2, { dx: 0.5, dy: -0.2 });
		expect(recipe.seatNudges).toEqual([{ row: 0, seat: 2, dx: 0.5, dy: -0.2 }]);
	});

	it('REPLACES the existing entry instead of appending a second one', () => {
		let recipe = defaultRowLayout();
		for (const dx of [0.1, 0.2, 0.3, 0.4]) {
			recipe = upsertNudge(recipe, 0, 2, { dx });
		}
		// The bake applies every matching entry in sequence, so duplicates would
		// compound to 1.0 instead of the intended 0.4.
		expect(recipe.seatNudges).toHaveLength(1);
		expect(recipe.seatNudges[0]).toEqual({ row: 0, seat: 2, dx: 0.4 });
	});

	it('merges fields: writing rot keeps the existing dx/dy', () => {
		const first = upsertNudge(defaultRowLayout(), 1, 0, { dx: 1, dy: 2 });
		const second = upsertNudge(first, 1, 0, { rot: 45 });
		expect(second.seatNudges).toEqual([{ row: 1, seat: 0, dx: 1, dy: 2, rot: 45 }]);
	});

	it('keeps distinct seats and rows apart', () => {
		let recipe = upsertNudge(defaultRowLayout(), 0, 0, { dx: 1 });
		recipe = upsertNudge(recipe, 0, 1, { dx: 2 });
		recipe = upsertNudge(recipe, 1, 0, { dx: 3 });
		expect(recipe.seatNudges).toHaveLength(3);
		expect(findNudge(recipe, 0, 1)?.dx).toBe(2);
	});

	it('drops the entry once every field is back to zero', () => {
		const nudged = upsertNudge(defaultRowLayout(), 0, 0, { dx: 1, rot: 30 });
		const flat = upsertNudge(nudged, 0, 0, { dx: 0, rot: 0 });
		expect(flat.seatNudges).toEqual([]);
	});

	it('sorts deterministically so a saved recipe does not churn', () => {
		let recipe = upsertNudge(defaultRowLayout(), 2, 1, { dx: 1 });
		recipe = upsertNudge(recipe, 0, 3, { dx: 1 });
		recipe = upsertNudge(recipe, 0, 1, { dx: 1 });
		expect(recipe.seatNudges.map((n) => `${n.row}-${n.seat}`)).toEqual(['0-1', '0-3', '2-1']);
	});

	it('never mutates the recipe it is given', () => {
		const original = defaultRowLayout();
		upsertNudge(original, 0, 0, { dx: 1 });
		expect(original.seatNudges).toEqual([]);
	});

	it('round-trips through persistence unchanged', () => {
		const recipe = upsertNudge(defaultRowLayout(), 1, 4, { dx: 1.5, dy: -0.5, rot: 90 });
		const parsed = parseRowLayout({ rowLayout: serializeRowLayout(recipe) });
		expect(parsed.status).toBe('ok');
		if (parsed.status !== 'ok') return;
		expect(parsed.recipe.seatNudges).toEqual(recipe.seatNudges);
	});
});

describe('clearNudge', () => {
	it('removes only the addressed seat', () => {
		let recipe = upsertNudge(defaultRowLayout(), 0, 0, { dx: 1 });
		recipe = upsertNudge(recipe, 0, 1, { dx: 2 });
		const cleared = clearNudge(recipe, 0, 0);
		expect(cleared.seatNudges).toEqual([{ row: 0, seat: 1, dx: 2 }]);
	});

	it('is a no-op for a seat with no nudge', () => {
		const recipe = upsertNudge(defaultRowLayout(), 0, 0, { dx: 1 });
		expect(clearNudge(recipe, 5, 5).seatNudges).toEqual(recipe.seatNudges);
	});
});

describe('drag delta → bake, end to end', () => {
	it('the dropped seat lands exactly where the delta says, and nothing else moves', () => {
		const cells = cellMap(['0-0', '0-1', '0-2', '1-0', '1-1', '1-2']);
		const bakeWith = (recipe = defaultRowLayout()) =>
			bakeSeatPositions({
				cells,
				verticalAisles: [],
				horizontalAisles: [],
				invertRowOrder: false,
				recipe
			});

		const before = bakeWith();
		// Rank 0 = physical row 0 here (not inverted); seat 1 = column 1.
		const recipe = upsertNudge(defaultRowLayout(), 0, 1, {
			dx: snapNudge(0.63),
			dy: snapNudge(-0.44)
		});
		const after = bakeWith(recipe);

		expect(after.get('0-1')).toEqual({ x: 1.6, y: -0.4 });
		for (const key of ['0-0', '0-2', '1-0', '1-1', '1-2']) {
			expect(after.get(key)).toEqual(before.get(key));
		}
	});

	it('a second drag of the same seat replaces, so the seat does not run away', () => {
		const cells = cellMap(['0-0', '0-1', '0-2']);
		let recipe = upsertNudge(defaultRowLayout(), 0, 1, { dx: 1 });
		recipe = upsertNudge(recipe, 0, 1, { dx: 2 });
		const baked = bakeSeatPositions({
			cells,
			verticalAisles: [],
			horizontalAisles: [],
			invertRowOrder: false,
			recipe
		});
		expect(baked.get('0-1')?.x).toBe(3); // base 1 + 2, not 1 + 1 + 2
	});
});

describe('nearestRowIndex — "add a seat where I clicked"', () => {
	const centerlines = [
		{ row: 0, y: 0 },
		{ row: 1, y: 1 },
		{ row: 4, y: 5 }
	];

	it('picks the closest row centreline', () => {
		expect(nearestRowIndex(centerlines, 0.2)).toBe(0);
		expect(nearestRowIndex(centerlines, 0.9)).toBe(1);
		expect(nearestRowIndex(centerlines, 4.4)).toBe(4);
	});

	it('clamps outside the grid to the nearest edge row', () => {
		expect(nearestRowIndex(centerlines, -99)).toBe(0);
		expect(nearestRowIndex(centerlines, 99)).toBe(4);
	});

	it('breaks ties toward the first row listed', () => {
		expect(nearestRowIndex(centerlines, 0.5)).toBe(0);
	});

	it('returns null when there are no rows at all', () => {
		expect(nearestRowIndex([], 3)).toBeNull();
	});
});

describe('appending a seat to a row', () => {
	it('takes the column after the row’s right-most seat', () => {
		const cells = cellMap(['0-0', '0-1', '0-2', '1-0']);
		expect(nextColumnInRow(cells, 0)).toBe(3);
		expect(nextColumnInRow(cells, 1)).toBe(1);
	});

	it('starts at 0 for an empty row', () => {
		expect(nextColumnInRow(cellMap(['1-0']), 0)).toBe(0);
	});

	it('ignores holes and deleted cells', () => {
		const cells = cellMap(['0-0', '0-4']);
		cells.set('0-9', { exists: false, is_accessible: false, is_obstructed_view: false });
		expect(nextColumnInRow(cells, 0)).toBe(5);
	});

	it('grows the grid only when the append passes the right edge', () => {
		expect(growColumns(5, 3)).toBe(5);
		expect(growColumns(5, 4)).toBe(5);
		expect(growColumns(5, 5)).toBe(6);
	});
});

describe('SeatAdjustState', () => {
	it('starts off, with nothing selected', () => {
		const state = new SeatAdjustState();
		expect(state.active).toBe(false);
		expect(state.selected).toBeNull();
	});

	it('leaving the mode clears the selection, the add arm and any drag', () => {
		const state = new SeatAdjustState();
		state.setActive(true);
		state.setAddArmed(true);
		state.select({ row: 1, col: 2 });
		state.drag = { key: '1-2', dx: 10, dy: 4 };

		state.toggleActive();
		expect(state.active).toBe(false);
		expect(state.addArmed).toBe(false);
		expect(state.selected).toBeNull();
		expect(state.drag).toBeNull();
	});

	it('refuses to arm "add seat" while the mode is off', () => {
		const state = new SeatAdjustState();
		state.setAddArmed(true);
		expect(state.addArmed).toBe(false);
	});

	it('reports the selected cell and the live drag offset', () => {
		const state = new SeatAdjustState();
		state.setActive(true);
		state.select({ row: 2, col: 3 });
		expect(state.isSelected(2, 3)).toBe(true);
		expect(state.isSelected(2, 4)).toBe(false);

		state.drag = { key: '2-3', dx: 12, dy: -8 };
		expect(state.offsetFor('2-3')).toEqual({ dx: 12, dy: -8 });
		expect(state.offsetFor('2-4')).toEqual({ dx: 0, dy: 0 });
	});
});

describe('remapNudgeRanks — populated rows changed under the nudges', () => {
	it('re-addresses nudges when an empty row between two populated ones fills up', () => {
		// Before: rows 0 and 2 are populated → ranks 0 and 1.
		let recipe = upsertNudge(defaultRowLayout(), 0, 1, { dx: 1 });
		recipe = upsertNudge(recipe, 1, 3, { dy: 2 });
		// After: row 1 gains its first seat → rows 0,1,2 → ranks 0,1,2.
		const remapped = remapNudgeRanks(recipe, [0, 2], [0, 1, 2], false);
		expect(remapped.seatNudges).toEqual([
			{ row: 0, seat: 1, dx: 1 },
			{ row: 2, seat: 3, dy: 2 }
		]);
	});

	it('follows the inverted ranking', () => {
		// Inverted, rows [0, 2]: row 2 is the FRONT row (rank 0), row 0 is rank 1.
		// So this nudge belongs to physical row 0.
		const recipe = upsertNudge(defaultRowLayout(), 1, 4, { dx: 1 });
		const remapped = remapNudgeRanks(recipe, [0, 2], [0, 1, 2], true);
		// With row 1 populated too, row 0 is now the BACK row: rank 2, not 1.
		expect(remapped.seatNudges).toEqual([{ row: 2, seat: 4, dx: 1 }]);
	});

	it('drops nudges whose row lost its last seat', () => {
		let recipe = upsertNudge(defaultRowLayout(), 0, 0, { dx: 1 });
		recipe = upsertNudge(recipe, 1, 0, { dx: 2 });
		const remapped = remapNudgeRanks(recipe, [0, 5], [5], false);
		expect(remapped.seatNudges).toEqual([{ row: 0, seat: 0, dx: 2 }]);
	});

	it('is a no-op when the row set is unchanged', () => {
		const recipe = upsertNudge(defaultRowLayout(), 1, 2, { dx: 1, rot: 30 });
		expect(remapNudgeRanks(recipe, [0, 1], [0, 1], false).seatNudges).toEqual(recipe.seatNudges);
	});

	it('re-addresses rowOverrides the same way, alongside seatNudges', () => {
		// Before: rows 0 and 2 populated — row 2 is rank 1.
		const recipe = { ...defaultRowLayout(), rowOverrides: [{ row: 1, curve: 5 }] };
		// After: row 1 gains a seat too, so row 2 becomes rank 2.
		const remapped = remapNudgeRanks(recipe, [0, 2], [0, 1, 2], false);
		expect(remapped.rowOverrides).toEqual([{ row: 2, curve: 5 }]);
	});

	it('drops a rowOverride whose row lost its last seat, keeping the same physical row for the survivor', () => {
		const recipe = {
			...defaultRowLayout(),
			rowOverrides: [
				{ row: 0, curve: 3 },
				{ row: 1, curve: -3 }
			]
		};
		// Row 0 (rank 0) empties; row 5 (rank 1) survives and becomes rank 0.
		const remapped = remapNudgeRanks(recipe, [0, 5], [5], false);
		expect(remapped.rowOverrides).toEqual([{ row: 0, curve: -3 }]);
	});
});

describe('SeatDragController', () => {
	const pointer = (x: number, y: number, shiftKey = false) =>
		({ clientX: x, clientY: y, shiftKey }) as PointerEvent;

	function controller() {
		const state = new SeatAdjustState();
		state.setActive(true);
		const commits: Array<{
			row: number;
			col: number;
			delta: { dx: number; dy: number };
			coarse: boolean;
		}> = [];
		const drag = new SeatDragController(() => state, {
			cellPx: 48,
			onCommit: (row, col, delta, coarse) => commits.push({ row, col, delta, coarse })
		});
		return { state, drag, commits };
	}

	it('converts the drop to seat pitches and commits ONCE, at the end', () => {
		const { drag, commits } = controller();
		drag.start(1, 2, pointer(100, 100));
		drag.move(pointer(112, 100));
		drag.move(pointer(124, 76));
		expect(commits).toHaveLength(0);

		drag.finish(pointer(124, 76));
		expect(commits).toEqual([{ row: 1, col: 2, delta: { dx: 0.5, dy: -0.5 }, coarse: false }]);
	});

	it('moves the button live, in pixels, and clears the offset on release', () => {
		const { state, drag } = controller();
		drag.start(0, 3, pointer(0, 0));
		drag.move(pointer(20, -10));
		expect(state.offsetFor('0-3')).toEqual({ dx: 20, dy: -10 });
		expect(state.offsetFor('0-2')).toEqual({ dx: 0, dy: 0 });

		drag.finish(pointer(20, -10));
		expect(state.drag).toBeNull();
	});

	it('a press that never travels stays a click (no commit)', () => {
		const { drag, commits } = controller();
		drag.start(0, 0, pointer(50, 50));
		drag.move(pointer(51, 50));
		expect(drag.isDragging).toBe(false);
		expect(drag.finish(pointer(51, 50))).toBe(false);
		expect(commits).toEqual([]);
	});

	it('reports the Shift modifier so the caller can snap coarsely', () => {
		const { drag, commits } = controller();
		drag.start(2, 2, pointer(0, 0));
		drag.move(pointer(30, 0));
		drag.finish(pointer(30, 0, true));
		expect(commits[0].coarse).toBe(true);
	});

	it('a cancelled gesture commits nothing and drops the live offset', () => {
		const { state, drag, commits } = controller();
		drag.start(1, 1, pointer(0, 0));
		drag.move(pointer(40, 40));
		drag.cancel();
		expect(state.drag).toBeNull();
		expect(drag.finish(pointer(40, 40))).toBe(false);
		expect(commits).toEqual([]);
	});
});

describe('mirrorRowRanks — the row-order toggle (seat follows seat)', () => {
	it('flips every nudge rank so the SAME physical seat keeps its delta', () => {
		const cells = cellMap(['0-0', '0-1', '1-0', '1-1', '2-0', '2-1']);
		const bake = (recipe: ReturnType<typeof defaultRowLayout>, invert: boolean) =>
			bakeSeatPositions({
				cells,
				verticalAisles: [],
				horizontalAisles: [],
				invertRowOrder: invert,
				recipe
			});

		// Rank 0 with rows 0..2 NOT inverted = physical row 0.
		const upright = upsertNudge(defaultRowLayout(), 0, 1, { dx: 2, rot: 30 });
		const before = bake(upright, false);
		expect(before.get('0-1')).toEqual({ x: 3, y: 0 });

		// Inverting re-ranks (row 0 becomes rank 2) but moves nothing physically.
		const inverted = mirrorRowRanks(upright, 3);
		expect(inverted.seatNudges).toEqual([{ row: 2, seat: 1, dx: 2, rot: 30 }]);
		expect(bake(inverted, true).get('0-1')).toEqual({ x: 3, y: 0 });
		// And every other seat is exactly where it was, too.
		expect([...bake(inverted, true).entries()]).toEqual([...before.entries()]);
	});

	it('mirrors rowOverrides in the same motion', () => {
		const recipe = {
			...defaultRowLayout(),
			rowOverrides: [
				{ row: 0, dx: 1 },
				{ row: 2, curve: 5 }
			]
		};
		expect(mirrorRowRanks(recipe, 3).rowOverrides).toEqual([
			{ row: 0, curve: 5 },
			{ row: 2, dx: 1 }
		]);
	});

	it('is its own inverse — toggling back restores the original recipe', () => {
		const recipe = upsertNudge(defaultRowLayout(), 1, 3, { dy: -1.5 });
		expect(mirrorRowRanks(mirrorRowRanks(recipe, 4), 4).seatNudges).toEqual(recipe.seatNudges);
	});

	it('drops entries addressing ranks outside the current row space', () => {
		let recipe = upsertNudge(defaultRowLayout(), 0, 0, { dx: 1 });
		recipe = upsertNudge(recipe, 9, 0, { dx: 2 });
		expect(mirrorRowRanks(recipe, 2).seatNudges).toEqual([{ row: 1, seat: 0, dx: 1 }]);
	});

	it('handles a single-row (and an empty) sector without producing junk ranks', () => {
		const single = upsertNudge(defaultRowLayout(), 0, 0, { dx: 1 });
		expect(mirrorRowRanks(single, 1).seatNudges).toEqual([{ row: 0, seat: 0, dx: 1 }]);
		expect(mirrorRowRanks(single, 0).seatNudges).toEqual([]);
	});
});

describe('SeatDragController — abandoning a gesture', () => {
	it('cancel() mid-drag leaves nothing to commit', () => {
		const state = new SeatAdjustState();
		state.setActive(true);
		const commits: unknown[] = [];
		const drag = new SeatDragController(() => state, {
			cellPx: 48,
			onCommit: () => commits.push(1)
		});

		drag.start(0, 0, { clientX: 0, clientY: 0 } as PointerEvent);
		drag.move({ clientX: 48, clientY: 0 } as PointerEvent);
		expect(drag.isDragging).toBe(true);

		drag.cancel();
		expect(drag.isDragging).toBe(false);
		expect(state.drag).toBeNull();
		expect(drag.finish({ clientX: 48, clientY: 0, shiftKey: false } as PointerEvent)).toBe(false);
		expect(commits).toEqual([]);
	});

	it('leaving the mode drops the live offset', () => {
		const state = new SeatAdjustState();
		state.setActive(true);
		state.drag = { key: '0-0', dx: 10, dy: 10 };
		state.setActive(false);
		expect(state.drag).toBeNull();
	});
});
