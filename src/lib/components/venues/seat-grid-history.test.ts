import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import type { SeatData } from './seat-grid-types';
import { defaultRowLayout, type RowLayoutRecipe } from './row-layout';
import {
	HISTORY_CAP,
	UndoHistory,
	captureEditorSnapshot,
	createEditorHistory,
	restoreEditorSnapshot,
	undoRedoIntent,
	type EditorScalars,
	type EditorStateAccess,
	type EditorSnapshot
} from './seat-grid-history.svelte';

/** A trivially snapshot-able state, for the stack semantics themselves. */
function counterHistory(cap?: number) {
	const box = { value: 0 };
	const history = new UndoHistory<number>({
		capture: () => box.value,
		restore: (snapshot) => {
			box.value = snapshot;
		},
		cap
	});
	return { box, history };
}

/** A stand-in editor: the same containers SeatGridEditor owns. */
function editorAccess() {
	const cells = new SvelteMap<string, SeatData>();
	const verticalAisles = new SvelteSet<number>();
	const horizontalAisles = new SvelteSet<number>();
	const scalars: EditorScalars = {
		rows: 3,
		columns: 4,
		useLetters: true,
		invertRowOrder: false,
		recipe: defaultRowLayout()
	};
	const access: EditorStateAccess = {
		cells,
		verticalAisles,
		horizontalAisles,
		readScalars: () => ({ ...scalars }),
		writeScalars: (next) => {
			Object.assign(scalars, next);
		}
	};
	return { access, cells, verticalAisles, horizontalAisles, scalars };
}

const seat = (): SeatData => ({
	exists: true,
	is_accessible: false,
	is_obstructed_view: false
});

describe('UndoHistory — stack semantics', () => {
	it('undo restores the state as it was BEFORE the committed mutation', () => {
		const { box, history } = counterHistory();
		expect(history.canUndo).toBe(false);

		history.commit();
		box.value = 1;
		expect(history.canUndo).toBe(true);

		expect(history.undo()).toBe(true);
		expect(box.value).toBe(0);
		expect(history.canUndo).toBe(false);
		expect(history.canRedo).toBe(true);
	});

	it('redo replays the undone mutation, and both are idempotent at the ends', () => {
		const { box, history } = counterHistory();
		history.commit();
		box.value = 1;
		history.undo();

		expect(history.redo()).toBe(true);
		expect(box.value).toBe(1);
		expect(history.redo()).toBe(false);
		expect(box.value).toBe(1);

		history.undo();
		expect(history.undo()).toBe(false);
		expect(box.value).toBe(0);
	});

	it('walks a multi-step stack in order', () => {
		const { box, history } = counterHistory();
		for (const value of [1, 2, 3]) {
			history.commit();
			box.value = value;
		}
		expect(history.depth).toEqual({ past: 3, future: 0 });

		history.undo();
		expect(box.value).toBe(2);
		history.undo();
		expect(box.value).toBe(1);
		history.redo();
		expect(box.value).toBe(2);
		history.redo();
		expect(box.value).toBe(3);
	});

	it('a new commit after an undo clears the redo stack', () => {
		const { box, history } = counterHistory();
		history.commit();
		box.value = 1;
		history.undo();
		expect(history.canRedo).toBe(true);

		history.commit();
		box.value = 9;
		expect(history.canRedo).toBe(false);
		history.undo();
		expect(box.value).toBe(0);
	});

	it('caps the undo stack, dropping the OLDEST entries', () => {
		const { box, history } = counterHistory(3);
		for (const value of [1, 2, 3, 4, 5]) {
			history.commit();
			box.value = value;
		}
		expect(history.depth.past).toBe(3);

		// Only the last three pre-mutation states survive: 4, 3, 2.
		history.undo();
		expect(box.value).toBe(4);
		history.undo();
		expect(box.value).toBe(3);
		history.undo();
		expect(box.value).toBe(2);
		expect(history.undo()).toBe(false);
	});

	it('defaults to a 100-entry cap', () => {
		const { box, history } = counterHistory();
		for (let value = 1; value <= HISTORY_CAP + 10; value++) {
			history.commit();
			box.value = value;
		}
		expect(history.depth.past).toBe(HISTORY_CAP);
	});
});

describe('UndoHistory — coalescing (sliders, typed numbers, one entry per drag)', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('a burst of same-key debounced commits pushes exactly one entry', () => {
		const { box, history } = counterHistory();
		for (const value of [1, 2, 3, 4]) {
			history.commitDebounced('curve');
			box.value = value;
			vi.advanceTimersByTime(50);
		}
		expect(history.depth.past).toBe(1);
		history.undo();
		expect(box.value).toBe(0);
	});

	it('a burst that lapses starts a new entry', () => {
		const { box, history } = counterHistory();
		history.commitDebounced('curve');
		box.value = 1;
		vi.advanceTimersByTime(400);
		history.commitDebounced('curve');
		box.value = 2;

		expect(history.depth.past).toBe(2);
		history.undo();
		expect(box.value).toBe(1);
	});

	it('a different key, or a discrete commit, closes the open burst', () => {
		const { box, history } = counterHistory();
		history.commitDebounced('curve');
		box.value = 1;
		history.commitDebounced('stagger');
		box.value = 2;
		history.commit();
		box.value = 3;

		expect(history.depth.past).toBe(3);
	});

	it('a drag that commits once at pointerup is a single entry', () => {
		// The drag itself never mutates persisted state — only pointerup does —
		// so a whole gesture is one plain commit, no coalescing needed.
		const { box, history } = counterHistory();
		history.commit();
		box.value = 42;
		expect(history.depth.past).toBe(1);
	});

	it('undo closes an open burst, so the next edit is its own entry', () => {
		const { box, history } = counterHistory();
		history.commitDebounced('curve');
		box.value = 1;
		history.undo();
		expect(box.value).toBe(0);

		history.commitDebounced('curve');
		box.value = 5;
		expect(history.depth.past).toBe(1);
		history.undo();
		expect(box.value).toBe(0);
	});
});

describe('editor snapshots', () => {
	it('captures a deep copy: later mutations do not leak into the snapshot', () => {
		const { access, cells, verticalAisles, scalars } = editorAccess();
		cells.set('0-0', seat());
		verticalAisles.add(1);
		scalars.recipe = { ...defaultRowLayout(), seatNudges: [{ row: 0, seat: 0, dx: 0.5 }] };

		const snapshot = captureEditorSnapshot(access);
		cells.set('0-1', seat());
		cells.delete('0-0');
		verticalAisles.clear();
		scalars.recipe.seatNudges.push({ row: 1, seat: 1, dx: 9 });
		scalars.rows = 30;

		expect(snapshot.cells).toEqual([['0-0', seat()]]);
		expect(snapshot.verticalAisles).toEqual([1]);
		expect(snapshot.recipe.seatNudges).toEqual([{ row: 0, seat: 0, dx: 0.5 }]);
		expect(snapshot.rows).toBe(3);
	});

	it('restores into the SAME container instances (no reassignment)', () => {
		const { access, cells, verticalAisles, horizontalAisles, scalars } = editorAccess();
		cells.set('0-0', seat());
		const snapshot = captureEditorSnapshot(access);

		cells.clear();
		cells.set('2-2', seat());
		verticalAisles.add(3);
		horizontalAisles.add(1);
		scalars.columns = 12;

		restoreEditorSnapshot(access, snapshot);

		expect(access.cells).toBe(cells);
		expect([...cells.keys()]).toEqual(['0-0']);
		expect([...verticalAisles]).toEqual([]);
		expect([...horizontalAisles]).toEqual([]);
		expect(scalars.columns).toBe(4);
	});

	it('undo restores a toggled cell AND a written nudge together', () => {
		const { access, cells, scalars } = editorAccess();
		cells.set('0-0', seat());
		const history = createEditorHistory(access);

		history.commit();
		cells.set('0-1', seat());
		const nudged: RowLayoutRecipe = {
			...defaultRowLayout(),
			seatNudges: [{ row: 0, seat: 1, dx: 1.5, dy: -0.5 }]
		};
		scalars.recipe = nudged;

		history.undo();
		expect([...cells.keys()]).toEqual(['0-0']);
		expect(scalars.recipe.seatNudges).toEqual([]);

		history.redo();
		expect([...cells.keys()]).toEqual(['0-0', '0-1']);
		expect(scalars.recipe.seatNudges).toEqual([{ row: 0, seat: 1, dx: 1.5, dy: -0.5 }]);
	});

	it('runs afterRestore so stale selections can be dropped', () => {
		const { access } = editorAccess();
		const afterRestore = vi.fn();
		const snapshot: EditorSnapshot = captureEditorSnapshot(access);
		restoreEditorSnapshot({ ...access, afterRestore }, snapshot);
		expect(afterRestore).toHaveBeenCalledTimes(1);
	});
});

describe('undoRedoIntent', () => {
	const event = (init: Partial<KeyboardEvent> & { key: string }, target?: HTMLElement) => {
		const keyboardEvent = new KeyboardEvent('keydown', init);
		if (target) Object.defineProperty(keyboardEvent, 'target', { value: target });
		return keyboardEvent;
	};

	it('maps the three standard bindings', () => {
		expect(undoRedoIntent(event({ key: 'z', metaKey: true }))).toBe('undo');
		expect(undoRedoIntent(event({ key: 'z', ctrlKey: true }))).toBe('undo');
		expect(undoRedoIntent(event({ key: 'z', metaKey: true, shiftKey: true }))).toBe('redo');
		expect(undoRedoIntent(event({ key: 'Z', ctrlKey: true, shiftKey: true }))).toBe('redo');
		expect(undoRedoIntent(event({ key: 'y', ctrlKey: true }))).toBe('redo');
	});

	it('ignores plain keys and modifier-less presses', () => {
		expect(undoRedoIntent(event({ key: 'z' }))).toBeNull();
		expect(undoRedoIntent(event({ key: 'a', metaKey: true }))).toBeNull();
		expect(undoRedoIntent(event({ key: 'z', metaKey: true, altKey: true }))).toBeNull();
	});

	it('leaves native text undo alone inside form fields', () => {
		for (const tag of ['input', 'textarea', 'select'] as const) {
			const field = document.createElement(tag);
			expect(undoRedoIntent(event({ key: 'z', metaKey: true }, field))).toBeNull();
		}
		const editable = document.createElement('div');
		editable.contentEditable = 'true';
		Object.defineProperty(editable, 'isContentEditable', { value: true });
		expect(undoRedoIntent(event({ key: 'z', metaKey: true }, editable))).toBeNull();
	});
});
