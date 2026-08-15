/**
 * Session-only undo/redo for the sector editor.
 *
 * The unit of history is the WHOLE editor state (cells + paint/accessibility
 * flags, aisles, grid size/labels/inversion, and the row-geometry recipe
 * including per-seat nudges) — snapshotting anything narrower would let an undo
 * restore a cell map that disagrees with the recipe addressing it.
 *
 * Contract: `commit()` is called BEFORE a mutation, so the stack holds
 * pre-mutation states and no "current value" bookkeeping is needed. Continuous
 * controls (sliders, typed numbers) call `commitDebounced(key)` instead, which
 * pushes once per burst — dragging the curve slider is one undo entry, not one
 * per input event.
 *
 * Nothing here is persisted: reloading the editor starts from the saved sector.
 */
import type { SvelteMap, SvelteSet } from 'svelte/reactivity';
import type { SeatData } from './seat-grid-types';
import type { RowLayoutRecipe } from './row-layout';

/** Maximum undo entries kept; the oldest is dropped past this. */
export const HISTORY_CAP = 100;
/** Coalescing window for `commitDebounced`, in ms. */
export const HISTORY_DEBOUNCE_MS = 300;

export interface UndoHistoryOptions<T> {
	/** Snapshot the current state (must deep-copy: the live containers mutate). */
	capture: () => T;
	/** Write a snapshot back into the live containers. */
	restore: (snapshot: T) => void;
	cap?: number;
	debounceMs?: number;
}

export class UndoHistory<T> {
	private past = $state<T[]>([]);
	private future = $state<T[]>([]);
	/** Key of the burst currently open for coalescing (`commitDebounced`). */
	private openKey: string | null = null;
	private timer: ReturnType<typeof setTimeout> | null = null;
	private readonly cap: number;
	private readonly debounceMs: number;

	constructor(private readonly options: UndoHistoryOptions<T>) {
		this.cap = options.cap ?? HISTORY_CAP;
		this.debounceMs = options.debounceMs ?? HISTORY_DEBOUNCE_MS;
	}

	get canUndo(): boolean {
		return this.past.length > 0;
	}

	get canRedo(): boolean {
		return this.future.length > 0;
	}

	/** Entry counts, for tests and debugging. */
	get depth(): { past: number; future: number } {
		return { past: this.past.length, future: this.future.length };
	}

	/** Close any open coalescing burst so the next commit starts a new entry. */
	private closeBurst(): void {
		if (this.timer !== null) clearTimeout(this.timer);
		this.timer = null;
		this.openKey = null;
	}

	private push(stack: T[], snapshot: T): void {
		stack.push(snapshot);
		if (stack.length > this.cap) stack.splice(0, stack.length - this.cap);
	}

	/** Record the CURRENT state as an undo point. Call before mutating. */
	commit(): void {
		this.closeBurst();
		this.push(this.past, this.options.capture());
		this.future.length = 0;
	}

	/**
	 * Record the current state, but only once per `key` burst: repeated calls
	 * within `debounceMs` (a slider drag, a number field being typed into) keep
	 * extending the same burst and push nothing further, so the whole gesture
	 * undoes in one step. A `commit()` or a different key closes the burst.
	 */
	commitDebounced(key: string): void {
		if (this.openKey === key && this.timer !== null) {
			clearTimeout(this.timer);
			this.timer = setTimeout(() => this.closeBurst(), this.debounceMs);
			return;
		}
		this.commit();
		this.openKey = key;
		this.timer = setTimeout(() => this.closeBurst(), this.debounceMs);
	}

	undo(): boolean {
		this.closeBurst();
		const previous = this.past.pop();
		if (previous === undefined) return false;
		this.push(this.future, this.options.capture());
		this.options.restore(previous);
		return true;
	}

	redo(): boolean {
		this.closeBurst();
		const next = this.future.pop();
		if (next === undefined) return false;
		this.push(this.past, this.options.capture());
		this.options.restore(next);
		return true;
	}

	/** Drop all history (e.g. after hydrating a freshly loaded sector). */
	reset(): void {
		this.closeBurst();
		this.past.length = 0;
		this.future.length = 0;
	}

	/** Release the coalescing timer (component teardown). */
	dispose(): void {
		this.closeBurst();
	}
}

/** A full editor state, deep-copied out of the live reactive containers. */
export interface EditorSnapshot {
	cells: Array<[string, SeatData]>;
	verticalAisles: number[];
	horizontalAisles: number[];
	rows: number;
	columns: number;
	useLetters: boolean;
	invertRowOrder: boolean;
	recipe: RowLayoutRecipe;
}

/** The scalar half of the editor state (the half that isn't a collection). */
export interface EditorScalars {
	rows: number;
	columns: number;
	useLetters: boolean;
	invertRowOrder: boolean;
	recipe: RowLayoutRecipe;
}

/**
 * The live containers a snapshot reads from and writes back into. The maps and
 * sets are mutated IN PLACE on restore (never reassigned) — they are the same
 * `SvelteMap`/`SvelteSet` instances the grid, the geometry state and the save
 * plan already hold references to.
 */
export interface EditorStateAccess {
	cells: SvelteMap<string, SeatData>;
	verticalAisles: SvelteSet<number>;
	horizontalAisles: SvelteSet<number>;
	readScalars: () => EditorScalars;
	writeScalars: (scalars: EditorScalars) => void;
	/** Run after a restore (e.g. drop selections pointing at deleted cells). */
	afterRestore?: () => void;
}

export function cloneRecipe(recipe: RowLayoutRecipe): RowLayoutRecipe {
	return {
		...recipe,
		rowOverrides: recipe.rowOverrides.map((override) => ({ ...override })),
		seatNudges: recipe.seatNudges.map((nudge) => ({ ...nudge }))
	};
}

export function captureEditorSnapshot(access: EditorStateAccess): EditorSnapshot {
	const scalars = access.readScalars();
	return {
		cells: [...access.cells].map(([key, data]) => [key, { ...data }]),
		verticalAisles: [...access.verticalAisles],
		horizontalAisles: [...access.horizontalAisles],
		rows: scalars.rows,
		columns: scalars.columns,
		useLetters: scalars.useLetters,
		invertRowOrder: scalars.invertRowOrder,
		recipe: cloneRecipe(scalars.recipe)
	};
}

export function restoreEditorSnapshot(access: EditorStateAccess, snapshot: EditorSnapshot): void {
	access.cells.clear();
	for (const [key, data] of snapshot.cells) access.cells.set(key, { ...data });
	access.verticalAisles.clear();
	for (const column of snapshot.verticalAisles) access.verticalAisles.add(column);
	access.horizontalAisles.clear();
	for (const row of snapshot.horizontalAisles) access.horizontalAisles.add(row);
	access.writeScalars({
		rows: snapshot.rows,
		columns: snapshot.columns,
		useLetters: snapshot.useLetters,
		invertRowOrder: snapshot.invertRowOrder,
		recipe: cloneRecipe(snapshot.recipe)
	});
	access.afterRestore?.();
}

export function createEditorHistory(access: EditorStateAccess): UndoHistory<EditorSnapshot> {
	return new UndoHistory<EditorSnapshot>({
		capture: () => captureEditorSnapshot(access),
		restore: (snapshot) => restoreEditorSnapshot(access, snapshot)
	});
}

/**
 * True when a keyboard event should drive editor undo/redo rather than the
 * focused control's own text undo. Anything typed into a form field is left
 * alone on purpose — Cmd+Z inside a number input must stay native.
 */
export function undoRedoIntent(event: KeyboardEvent): 'undo' | 'redo' | null {
	if (!(event.metaKey || event.ctrlKey) || event.altKey) return null;
	const target = event.target;
	if (target instanceof HTMLElement) {
		const tag = target.tagName;
		if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
			return null;
		}
	}
	const key = event.key.toLowerCase();
	if (key === 'z') return event.shiftKey ? 'redo' : 'undo';
	if (key === 'y' && event.ctrlKey && !event.shiftKey) return 'redo';
	return null;
}
