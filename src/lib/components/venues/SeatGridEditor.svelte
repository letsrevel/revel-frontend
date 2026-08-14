<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { resolve } from '$app/paths';
	import type {
		VenueSeatSchema,
		PriceCategorySchema,
		Coordinate2d
	} from '$lib/api/generated/types.gen';
	import { createQuery } from '@tanstack/svelte-query';
	import { organizationadminvenuesListPriceCategories } from '$lib/api/generated/sdk.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Redo2, Undo2 } from '@lucide/svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import type { SeatData } from './seat-grid-types';
	import { buildSeatSavePlan, type SeatSavePlan } from './seat-grid-save';
	import {
		defaultRowLayout,
		isDefaultRowLayout,
		resolveRowLayoutForSave,
		rotationsByLabel,
		type RowLayoutRecipe
	} from './row-layout';
	import { cellKeyFor, hydrateGrid, rowLabelFor, seatLabelFor } from './seat-grid-hydrate';
	import type { AisleMetadata } from './seat-grid-hydrate';
	import { SeatAdjustState } from './seat-adjust-state.svelte';
	import { SeatAdjustActions } from './seat-grid-adjust-actions.svelte';
	import { createEditorHistory, undoRedoIntent } from './seat-grid-history.svelte';
	import { SeatGeometryState } from './seat-grid-geometry-state.svelte';
	import { autoFitShape, fitsWithinShape } from './shape-fit';
	import SeatGridConfig from './SeatGridConfig.svelte';
	import SeatGrid from './SeatGrid.svelte';
	import SeatGeometryPanel from './SeatGeometryPanel.svelte';
	import SeatPaintPalette from './SeatPaintPalette.svelte';
	import SeatGridLegend from './SeatGridLegend.svelte';
	import SeatSelectionActions from './SeatSelectionActions.svelte';
	import SeatAdjustInspector from './SeatAdjustInspector.svelte';
	import ShapeFitDialog from './ShapeFitDialog.svelte';

	/**
	 * Everything one save persists to sector.metadata (+ shape). `rowLayout:
	 * undefined` ⇒ REMOVE the metadata key (plain grid stays byte-identical to
	 * today); otherwise written verbatim, and typed `unknown` because an
	 * untouched 'unsupported' blob (see `resolveRowLayoutForSave`) rides through
	 * byte-for-byte and is whatever a newer build wrote. `shape: undefined` ⇒
	 * untouched, `null` ⇒ clear, an array ⇒ replace; the page writes it FIRST,
	 * before any seat write, because the backend validates seat positions
	 * against the persisted shape (see handlePersist).
	 */
	export interface SectorMetadataUpdate {
		aisles: AisleMetadata;
		rowLayout: unknown;
		/**
		 * Buyer-facing rotation mirror `{ "<seat label>": degrees }` of the recipe's
		 * nudges (`rotationsByLabel`) — the buyer never receives `rowLayout`. An
		 * object ⇒ write it, `null` ⇒ REMOVE the key (nothing is rotated), key
		 * OMITTED ⇒ leave the stored one alone, which is what an untouched
		 * 'unsupported' recipe needs: its mirror belongs to the build that wrote it.
		 */
		seatRotations?: Record<string, number> | null;
		shape?: Coordinate2d[] | null;
	}

	interface Props {
		existingSeats: VenueSeatSchema[];
		sectorMetadata?: Record<string, unknown> | null;
		sectorShape: Coordinate2d[] | null;
		organizationSlug: string;
		venueId: string;
		onPersist: (plan: SeatSavePlan, metadata: SectorMetadataUpdate) => void;
		isSaving: boolean;
	}

	const {
		existingSeats,
		sectorMetadata,
		sectorShape,
		organizationSlug,
		venueId,
		onPersist,
		isSaving
	}: Props = $props();

	const accessToken = $derived(authStore.accessToken);

	// Venue price categories for the paint palette. Same key as
	// PriceCategorySection so both share one cache entry.
	const categoriesQuery = createQuery<PriceCategorySchema[]>(() => ({
		queryKey: ['org-admin', organizationSlug, 'venue', venueId, 'price-categories'],
		queryFn: async () => {
			const response = await organizationadminvenuesListPriceCategories({
				path: { slug: organizationSlug, venue_id: venueId },
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (response.error || !response.data) {
				throw new Error('Failed to load price categories');
			}

			return response.data;
		}
	}));
	const priceCategories = $derived(categoriesQuery.data ?? []);

	// Price categories are created/managed on the venue page (PriceCategorySection),
	// not here — deep-link there so the empty palette isn't a dead end.
	const manageCategoriesHref = $derived(
		resolve('/(auth)/org/[slug]/admin/venues/[venue_id]', {
			slug: organizationSlug,
			venue_id: venueId
		}) + '#price-categories'
	);

	// Active paint chip: null = paint mode off; categoryId null = eraser
	let activePaint = $state<{ categoryId: string | null } | null>(null);

	function togglePaint(categoryId: string | null) {
		activePaint = activePaint && activePaint.categoryId === categoryId ? null : { categoryId };
	}

	// Apply the active paint chip to every selected seat
	function paintSelected() {
		if (!activePaint) return;
		history.commit();
		for (const key of selectedCells) {
			const seat = seats.get(key);
			if (seat?.exists) {
				seats.set(key, { ...seat, priceCategoryId: activePaint.categoryId });
			}
		}
	}

	// Grid configuration
	let rows = $state(10);
	let columns = $state(10);
	let useLetters = $state(true);
	let invertRowOrder = $state(false);

	// Aisle configuration (column/row indices after which aisles appear)
	const verticalAisles = new SvelteSet<number>();
	const horizontalAisles = new SvelteSet<number>();

	// Seat state: Map of "row-col" -> seat metadata
	const seats = new SvelteMap<string, SeatData>();

	// Selection state
	const selectedCells = new SvelteSet<string>();

	// Row-geometry recipe (curve/stagger/align/per-row overrides), edited via
	// SeatGeometryPanel and baked into per-seat positions on save.
	let rowLayout = $state<RowLayoutRecipe>(defaultRowLayout());
	let rowLayoutRaw = $state<Record<string, unknown> | undefined>(undefined);
	let rowLayoutUnsupported = $state(false);
	// The original, unparsed metadata.rowLayout value when parse status is
	// 'unsupported' (a newer-format blob this build can't read) — preserved so
	// an untouched save can write it back verbatim instead of destroying it.
	// See `resolveRowLayoutForSave`.
	let rowLayoutUnsupportedRaw = $state<unknown>(undefined);
	// Seats off the grid lattice with no stored recipe — the fingerprint of a
	// save whose seat writes landed and whose metadata write didn't. Warn only.
	let rowLayoutDesynced = $state(false);

	// Shape-fit gate (runs on SAVE only): a baked layout that no longer fits
	// the sector's drawn outline offers an auto-fit replacement or clearing it.
	let shapeDialogOpen = $state(false);
	let pendingShape = $state<Coordinate2d[] | null>(null);
	let violatingCount = $state(0);

	// Track if grid has been initialized
	let initialized = $state(false);

	// Label vocabulary (pure, shared with the save plan and the hydrator).
	function getRowLabel(index: number): string {
		return rowLabelFor(index, useLetters);
	}

	function getSeatLabel(rowIndex: number, colIndex: number): string {
		return seatLabelFor(rowIndex, colIndex, useLetters);
	}

	function getCellKey(row: number, col: number): string {
		return cellKeyFor(row, col);
	}

	// Initialize grid from existing seats and metadata. Guarded by the
	// `initialized` flag below, and every write here is a plain overwrite
	// (clear-then-repopulate or direct reassignment) rather than additive.
	function initializeFromExisting() {
		const hydrated = hydrateGrid({ existingSeats, sectorMetadata, rows, columns, useLetters });

		seats.clear();
		for (const [key, data] of hydrated.cells) seats.set(key, data);

		if (hydrated.aisles) {
			verticalAisles.clear();
			horizontalAisles.clear();
			for (const col of hydrated.aisles.verticalAisles) verticalAisles.add(col);
			for (const row of hydrated.aisles.horizontalAisles) horizontalAisles.add(row);
			invertRowOrder = hydrated.aisles.invertRowOrder;
		}

		rowLayout = hydrated.rowLayout;
		rowLayoutRaw = hydrated.rowLayoutRaw;
		rowLayoutUnsupported = hydrated.rowLayoutUnsupported;
		rowLayoutUnsupportedRaw = hydrated.rowLayoutUnsupportedRaw;
		rowLayoutDesynced = hydrated.rowLayoutDesynced;
		useLetters = hydrated.useLetters;
		rows = hydrated.rows;
		columns = hydrated.columns;

		// Hydration is not an edit: nothing before this point is undoable.
		history.reset();
		initialized = true;
	}

	// Generate empty grid
	function generateEmptyGrid() {
		history.commit();
		adjustActions.forgetAllNudges();
		seats.clear();
		selectedCells.clear();
		verticalAisles.clear();
		horizontalAisles.clear();
		initialized = true;
	}

	// Generate full grid (all seats)
	function generateFullGrid() {
		history.commit();
		adjustActions.forgetAllNudges();
		seats.clear();
		for (let r = 0; r < rows; r++) {
			for (let c = 0; c < columns; c++) {
				seats.set(getCellKey(r, c), {
					exists: true,
					is_accessible: false,
					is_obstructed_view: false
				});
			}
		}
		selectedCells.clear();
		verticalAisles.clear();
		horizontalAisles.clear();
		initialized = true;
	}

	// Delete selected seats
	function deleteSelected() {
		history.commit();
		const before = geometry.populatedRows;
		// Addresses must be read while the rows are still populated — ranks are
		// dense over populated rows, so they shift the moment a row empties.
		const removed = [...selectedCells].map((key) => {
			const [row, col] = key.split('-').map(Number);
			return adjustActions.nudgeAddress(row, col);
		});
		for (const key of selectedCells) {
			seats.delete(key);
		}
		selectedCells.clear();
		dropStaleSelection();
		adjustActions.forgetNudgesAt(removed);
		adjustActions.reindexNudges(before);
	}

	// Mark selected seats as accessible
	function markSelectedAccessible() {
		history.commit();
		for (const key of selectedCells) {
			const seat = seats.get(key);
			if (seat) {
				seats.set(key, { ...seat, is_accessible: !seat.is_accessible });
			}
		}
	}

	// Mark selected seats as obstructed view
	function markSelectedObstructed() {
		history.commit();
		for (const key of selectedCells) {
			const seat = seats.get(key);
			if (seat) {
				seats.set(key, { ...seat, is_obstructed_view: !seat.is_obstructed_view });
			}
		}
	}

	// Clear selection
	function clearSelection() {
		selectedCells.clear();
	}

	// All derived geometry (real bake, display lattice, row options, thumbnail
	// seats) lives in one runes class so this component stays inside its file
	// cap. The bake is the single source of truth for BOTH the save payload and
	// the position the grid draws each cell at — the editor is the preview.
	const geometry = new SeatGeometryState({
		cells: seats,
		verticalAisles,
		horizontalAisles,
		rows: () => rows,
		columns: () => columns,
		invertRowOrder: () => invertRowOrder,
		recipe: () => rowLayout,
		priceCategories: () => priceCategories,
		rowLabel: getRowLabel
	});

	// --- Undo/redo ---------------------------------------------------------
	// One history over the WHOLE editor state: cells (with paint and
	// accessibility), aisles, grid size/labels/inversion, and the geometry recipe
	// including per-seat nudges. Snapshots are restored INTO the live containers,
	// never over them, so the grid, the geometry state and the save plan keep
	// their references. Session-only: a reload starts from the saved sector.
	const history = createEditorHistory({
		cells: seats,
		verticalAisles,
		horizontalAisles,
		readScalars: () => ({ rows, columns, useLetters, invertRowOrder, recipe: rowLayout }),
		writeScalars: (scalars) => {
			rows = scalars.rows;
			columns = scalars.columns;
			useLetters = scalars.useLetters;
			invertRowOrder = scalars.invertRowOrder;
			rowLayout = scalars.recipe;
		},
		afterRestore: dropStaleSelection
	});

	/** Forget selections pointing at cells the restored state has no seat in. */
	function dropStaleSelection() {
		for (const key of [...selectedCells]) {
			if (!seats.get(key)?.exists) selectedCells.delete(key);
		}
		const picked = adjust.selected;
		if (picked && !seats.get(getCellKey(picked.row, picked.col))?.exists) adjust.select(null);
	}

	/** `commit`, or `commitDebounced` when the caller names a gesture. */
	function recordEdit(coalesceKey?: string) {
		if (coalesceKey === undefined) history.commit();
		else history.commitDebounced(coalesceKey);
	}

	function handleWindowKeydown(event: KeyboardEvent) {
		// Escape leaves adjust mode (but never fights the shape dialog's own).
		if (event.key === 'Escape' && adjust.active && !shapeDialogOpen) {
			adjust.setActive(false);
			return;
		}
		const intent = undoRedoIntent(event);
		if (intent === null) return;
		event.preventDefault();
		if (intent === 'undo') history.undo();
		else history.redo();
	}

	// --- Adjust seats ------------------------------------------------------
	// The mode/selection flag lives here; the actual nudge addressing, the
	// inspector's read/write surface, and the reindexing on a populated-row
	// change all live in `SeatAdjustActions` (seat-grid-adjust-actions.svelte.ts)
	// — extracted so this file stays inside its line cap. `adjustActions` is
	// also `SeatGrid`'s `onCellsMutated` callback: a NORMAL-mode add (click or
	// drag-fill) that populates a previously-empty row goes through the exact
	// same `reindexNudges` the adjust-mode paths use, via `SeatAdjustActions`.
	const adjust = new SeatAdjustState();
	const adjustActions = new SeatAdjustActions({
		adjust,
		selectedCells,
		seats,
		geometry,
		rowLayout: () => rowLayout,
		setRowLayout: (recipe) => {
			rowLayout = recipe;
		},
		rows: () => rows,
		setRows: (value) => {
			rows = value;
		},
		columns: () => columns,
		setColumns: (value) => {
			columns = value;
		},
		invertRowOrder: () => invertRowOrder,
		getCellKey,
		getSeatLabel,
		commit: () => history.commit(),
		commitDebounced: (key) => history.commitDebounced(key)
	});

	// Build the full persistence plan (creates/updates/deletes/paint batches,
	// with explicit row_order/adjacency_index ranks and baked positions).
	function buildPlan(): SeatSavePlan {
		return buildSeatSavePlan({
			cells: seats,
			existingSeats,
			rows,
			invertRowOrder,
			getRowLabel,
			getSeatLabel,
			getPosition: (rowIndex, colIndex) => geometry.positionAt(rowIndex, colIndex)
		});
	}

	// Hand the plan + metadata to the page, which sequences shape -> bulk ops ->
	// paint -> metadata. `shape` follows the SectorMetadataUpdate contract:
	// omitted key ⇒ untouched, `null` ⇒ clear, an array ⇒ replace.
	function persist(shape: Coordinate2d[] | null | undefined) {
		// An 'unsupported' recipe the admin never touched rides through verbatim
		// (resolveRowLayoutForSave) — so must its mirror, underivable from here.
		const keepMirror = rowLayoutUnsupported && isDefaultRowLayout(rowLayout);
		const rotations = rotationsByLabel(rowLayout.seatNudges, adjustActions.labelForAddress);
		onPersist(buildPlan(), {
			aisles: {
				verticalAisles: [...verticalAisles].sort((a, b) => a - b),
				horizontalAisles: [...horizontalAisles].sort((a, b) => a - b),
				invertRowOrder
			},
			rowLayout: resolveRowLayoutForSave(
				rowLayout,
				rowLayoutRaw,
				rowLayoutUnsupported,
				rowLayoutUnsupportedRaw
			),
			...(keepMirror
				? {}
				: { seatRotations: Object.keys(rotations).length > 0 ? rotations : null }),
			...(shape !== undefined ? { shape } : {})
		});
	}

	// Save changes. The shape gate runs on SAVE only (never live): a baked
	// layout that no longer fits the sector's drawn outline (>= 3 points) stops
	// the save and offers a regenerated fitted outline or clearing it via
	// ShapeFitDialog, instead of persisting seats the backend would reject.
	function handleSave() {
		const points = [...geometry.baked.values()];
		if (sectorShape && sectorShape.length >= 3 && !fitsWithinShape(points, sectorShape)) {
			violatingCount = points.filter((point) => !fitsWithinShape([point], sectorShape)).length;
			pendingShape = autoFitShape(points);
			shapeDialogOpen = true;
			return;
		}
		persist(undefined);
	}

	function handleShapeChoice(choice: 'fit' | 'clear' | 'cancel') {
		shapeDialogOpen = false;
		if (choice === 'cancel') {
			pendingShape = null;
			return;
		}
		persist(choice === 'fit' ? pendingShape : null);
		pendingShape = null;
	}

	// Count stats
	const totalSeats = $derived([...seats.values()].filter((s) => s.exists).length);
	const selectedCount = $derived(selectedCells.size);

	// Initialize on mount
	$effect(() => {
		if (!initialized && existingSeats) {
			initializeFromExisting();
		}
	});

	// Release the coalescing timer when the editor goes away.
	$effect(() => () => history.dispose());
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<div class="space-y-6">
	<!-- Grid Configuration -->
	<SeatGridConfig
		bind:rows
		bind:columns
		bind:useLetters
		bind:invertRowOrder
		onGenerateEmpty={generateEmptyGrid}
		onGenerateFull={generateFullGrid}
		onBeforeEdit={recordEdit}
		onRowOrderChange={adjustActions.handleRowOrderChange}
	/>

	<!-- Price category palette (seat painting) -->
	<SeatPaintPalette {priceCategories} {activePaint} {manageCategoriesHref} onToggle={togglePaint} />

	<!-- Seat editor toolbar: the "Adjust seats" mode switch (always first) plus,
	     only outside adjust mode with an active selection, the bulk selection
	     actions. -->
	<SeatSelectionActions
		{adjust}
		count={selectedCount}
		canPaint={activePaint !== null}
		onToggleAccessible={markSelectedAccessible}
		onToggleObstructed={markSelectedObstructed}
		onPaint={paintSelected}
		onDelete={deleteSelected}
		onClear={clearSelection}
	/>

	<!-- Single-seat inspector: a full-width row directly below the toolbar,
	     visible only while adjust mode is on AND a seat is selected. -->
	{#if adjust.active && adjustActions.selectedSeatLabel !== null}
		<SeatAdjustInspector
			selectedLabel={adjustActions.selectedSeatLabel}
			nudge={adjustActions.selectedNudge}
			onNudgeChange={adjustActions.handleInspectorChange}
			onResetSeat={adjustActions.handleResetSeat}
			onRemoveSeat={adjustActions.handleRemoveSeat}
		/>
	{/if}

	<!-- Grid + row-geometry panel split view. There is no separate preview any
	     more: the grid IS the preview, drawing every cell at its baked position.
	     The panel column comes FIRST in DOM order so the geometry controls are
	     keyboard-reachable without tabbing through the whole seat grid first;
	     explicit grid placement keeps the grid left and the panel right at `xl:`.
	     Stacked below `xl:`, the panel sits above the grid (mirrors
	     SeatGridConfig). `min-w-0` on the grid column is required — a flex/grid
	     child without it refuses to shrink below its content's intrinsic width,
	     which is the recurring mobile-overflow root cause in this codebase. -->
	<div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
		<div class="space-y-4 xl:col-start-2 xl:row-start-1">
			<SeatGeometryPanel
				bind:recipe={rowLayout}
				rowOptions={geometry.rowOptions}
				unsupported={rowLayoutUnsupported}
				desynced={rowLayoutDesynced}
				{invertRowOrder}
				onBeforeEdit={recordEdit}
			/>
		</div>
		<div class="min-w-0 xl:col-start-1 xl:row-start-1">
			<SeatGrid
				{seats}
				{selectedCells}
				{verticalAisles}
				{horizontalAisles}
				{rows}
				{columns}
				{invertRowOrder}
				{getRowLabel}
				{getSeatLabel}
				{getCellKey}
				positions={geometry.display}
				shape={sectorShape}
				proposedShape={pendingShape}
				{activePaint}
				{priceCategories}
				{adjust}
				rotationFor={adjustActions.rotationFor}
				onNudgeSeat={adjustActions.handleNudgeSeat}
				onAddSeatToRow={adjustActions.handleAddSeatToRow}
				onAddSeatAt={adjustActions.handleAddSeatAt}
				onCellsMutated={adjustActions.reindexNudges}
				onBeforeEdit={recordEdit}
			/>
		</div>
	</div>

	<!-- Legend & Stats -->
	<SeatGridLegend {priceCategories} {totalSeats} />

	<!-- Undo/redo + Save -->
	<div class="flex flex-wrap items-center justify-end gap-2">
		<button
			type="button"
			onclick={() => history.undo()}
			disabled={!history.canUndo}
			data-testid="seat-grid-undo"
			class="inline-flex items-center gap-1.5 rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
		>
			<Undo2 class="h-4 w-4" aria-hidden="true" />
			{m['seatGridEditor.adjust.undo']()}
		</button>
		<button
			type="button"
			onclick={() => history.redo()}
			disabled={!history.canRedo}
			data-testid="seat-grid-redo"
			class="inline-flex items-center gap-1.5 rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
		>
			<Redo2 class="h-4 w-4" aria-hidden="true" />
			{m['seatGridEditor.adjust.redo']()}
		</button>
		<button
			type="button"
			onclick={handleSave}
			disabled={isSaving}
			class="rounded-md bg-primary px-6 py-2 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
		>
			{isSaving ? m['orgAdmin.seats.grid.saving']() : m['orgAdmin.seats.grid.saveChanges']()}
		</button>
	</div>
</div>

<ShapeFitDialog
	bind:open={shapeDialogOpen}
	{violatingCount}
	seats={geometry.previewSeats}
	shape={sectorShape}
	proposedShape={pendingShape}
	{invertRowOrder}
	onChoose={handleShapeChoice}
/>
