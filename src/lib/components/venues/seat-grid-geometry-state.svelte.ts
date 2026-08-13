/**
 * Derived geometry for the sector editor (runes-in-a-class, mirroring
 * designer-floors.svelte.ts).
 *
 * SeatGridEditor owns the editable grid (cells, aisles, recipe); everything
 * COMPUTED from it lives here — the real bake (the save payload and the
 * position every seat is drawn at), the synthetic display lattice that gives
 * empty cells a place to sit on the same curve, the per-row override picker's
 * options, and the seat list the shape-fit thumbnail renders.
 *
 * Every derived reads its reactive operands unconditionally (SvelteMap/
 * SvelteSet spreads plus the accessor props) — no early return may skip a
 * read, or the derived freezes the way the TanStack tracked-props `||` bug did.
 */
import type { Coordinate2d, PriceCategorySchema } from '$lib/api/generated/types.gen';
import type { SvelteMap, SvelteSet } from 'svelte/reactivity';
import type { SeatData } from './seat-grid-types';
import type { RowLayoutRecipe } from './row-layout';
import { bakeSeatPositions } from './seat-layout-bake';
import { buildRowOrderLookup } from './seat-grid-save';
import { syntheticCells } from './seat-grid-layout';
import type { PreviewSeat } from './SeatLayoutPreview.svelte';
import type { RowOption } from './SeatGeometryPanel.svelte';

export interface SeatGeometrySources {
	/** The editor's live cell map (stable identity, mutated in place). */
	cells: SvelteMap<string, SeatData>;
	verticalAisles: SvelteSet<number>;
	horizontalAisles: SvelteSet<number>;
	rows: () => number;
	columns: () => number;
	invertRowOrder: () => boolean;
	recipe: () => RowLayoutRecipe;
	priceCategories: () => PriceCategorySchema[];
	rowLabel: (row: number) => string;
}

export class SeatGeometryState {
	constructor(private readonly sources: SeatGeometrySources) {}

	/**
	 * Baked positions for the cells that actually hold a seat — the single
	 * source of truth for the save payload AND for where the grid draws them.
	 */
	readonly baked = $derived.by(() =>
		bakeSeatPositions({
			cells: this.sources.cells,
			verticalAisles: [...this.sources.verticalAisles],
			horizontalAisles: [...this.sources.horizontalAisles],
			invertRowOrder: this.sources.invertRowOrder(),
			recipe: this.sources.recipe()
		})
	);

	/** Same bake over an all-exist grid: where an empty cell WOULD land. */
	private readonly lattice = $derived.by(() =>
		bakeSeatPositions({
			cells: syntheticCells(this.sources.rows(), this.sources.columns()),
			verticalAisles: [...this.sources.verticalAisles],
			horizontalAisles: [...this.sources.horizontalAisles],
			invertRowOrder: this.sources.invertRowOrder(),
			recipe: this.sources.recipe()
		})
	);

	/**
	 * Position for EVERY drawn cell: the real bake wins wherever a seat exists,
	 * the synthetic lattice fills in the empty click targets.
	 */
	readonly display = $derived.by(() => {
		// Plain Map on purpose: this is a derived VALUE, rebuilt from scratch on
		// every recompute and never mutated afterwards, so it needs no reactivity
		// of its own (same as the plain Map `bakeSeatPositions` returns).
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const merged = new Map<string, Coordinate2d>(this.lattice);
		for (const [key, point] of this.baked) merged.set(key, point);
		return merged;
	});

	/** Populated rows, dense-ranked front-to-back, for the override picker. */
	readonly rowOptions = $derived.by<RowOption[]>(() => {
		const populated = [
			// Throwaway dedupe inside a derived — spread immediately, never stored.
			// eslint-disable-next-line svelte/prefer-svelte-reactivity
			...new Set(
				[...this.sources.cells]
					.filter(([, data]) => data.exists)
					.map(([key]) => Number(key.split('-')[0]))
			)
		];
		const rankFor = buildRowOrderLookup(populated, this.sources.invertRowOrder());
		return populated
			.map((row) => ({ rank: rankFor(row), label: this.sources.rowLabel(row) }))
			.sort((a, b) => a.rank - b.rank);
	});

	/** Baked seats (with paint color) for the shape-fit thumbnail. */
	readonly previewSeats = $derived.by<PreviewSeat[]>(() => {
		const categories = this.sources.priceCategories();
		return [...this.sources.cells]
			.filter(([, data]) => data.exists)
			.map(([key, data]) => {
				const position = this.baked.get(key) ?? { x: 0, y: 0 };
				const category = categories.find((c) => c.id === data.priceCategoryId);
				return { key, x: position.x, y: position.y, categoryColor: category?.color ?? null };
			});
	});

	/** Baked position of one cell, falling back to its raw lattice index. */
	positionAt(row: number, col: number): Coordinate2d {
		return this.baked.get(`${row}-${col}`) ?? { x: col, y: row };
	}
}
