<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { resolve } from '$app/paths';
	import type { VenueSeatSchema, PriceCategorySchema } from '$lib/api/generated/types.gen';
	import { createQuery } from '@tanstack/svelte-query';
	import { organizationadminvenuesListPriceCategories } from '$lib/api/generated/sdk.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Accessibility, EyeOff, Paintbrush, Eraser, Tag, TriangleAlert } from '@lucide/svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import type { SeatData } from './seat-grid-types';
	import { buildSeatSavePlan, readExistingPaint, type SeatSavePlan } from './seat-grid-save';
	import SeatGridConfig from './SeatGridConfig.svelte';
	import SeatGrid from './SeatGrid.svelte';

	// Aisle metadata structure stored in sector
	export interface AisleMetadata {
		verticalAisles: number[]; // Column indices after which aisles appear
		horizontalAisles: number[]; // Row indices after which aisles appear
		invertRowOrder: boolean; // If true, row A is at the bottom
	}

	interface Props {
		existingSeats: VenueSeatSchema[];
		sectorMetadata?: { aisles?: AisleMetadata } | null;
		organizationSlug: string;
		venueId: string;
		onPersist: (plan: SeatSavePlan, metadata: { aisles: AisleMetadata }) => void;
		isSaving: boolean;
	}

	const { existingSeats, sectorMetadata, organizationSlug, venueId, onPersist, isSaving }: Props =
		$props();

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
	const eraserActive = $derived(activePaint !== null && activePaint.categoryId === null);

	function togglePaint(categoryId: string | null) {
		activePaint = activePaint && activePaint.categoryId === categoryId ? null : { categoryId };
	}

	// Apply the active paint chip to every selected seat
	function paintSelected() {
		if (!activePaint) return;
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

	// Track if grid has been initialized
	let initialized = $state(false);

	// Generate row label (A, B, C... or 1, 2, 3...)
	function getRowLabel(index: number): string {
		if (useLetters) {
			let label = '';
			let i = index;
			do {
				label = String.fromCharCode(65 + (i % 26)) + label;
				i = Math.floor(i / 26) - 1;
			} while (i >= 0);
			return label;
		}
		return String(index + 1);
	}

	// Get seat label from row and column
	function getSeatLabel(rowIndex: number, colIndex: number): string {
		const rowLabel = getRowLabel(rowIndex);
		const colLabel = colIndex + 1;
		// Use separator when both are numbers to avoid confusion (e.g., "1-1" instead of "11")
		if (!useLetters) {
			return `${rowLabel}-${colLabel}`;
		}
		return `${rowLabel}${colLabel}`;
	}

	// Get cell key
	function getCellKey(row: number, col: number): string {
		return `${row}-${col}`;
	}

	// Calculate actual X position accounting for vertical aisles
	function getXPosition(col: number): number {
		let x = col;
		for (const aisleCol of verticalAisles) {
			if (aisleCol <= col) x++;
		}
		return x;
	}

	// Calculate actual Y position accounting for horizontal aisles
	function getYPosition(row: number): number {
		let y = row;
		for (const aisleRow of horizontalAisles) {
			if (aisleRow <= row) y++;
		}
		return y;
	}

	// Parse a row label ("A", "AA", or "3") into a zero-based row index; -1 if unparseable
	function parseRowLabelToIndex(rowLabel: string): number {
		if (/^\d+$/.test(rowLabel)) {
			return parseInt(rowLabel, 10) - 1;
		}
		if (/^[A-Z]+$/i.test(rowLabel)) {
			const upper = rowLabel.toUpperCase();
			let index = 0;
			for (let i = 0; i < upper.length; i++) {
				index = index * 26 + (upper.charCodeAt(i) - 64);
			}
			return index - 1;
		}
		return -1;
	}

	// Initialize grid from existing seats and metadata
	function initializeFromExisting() {
		seats.clear();

		// Load aisle metadata if available
		if (sectorMetadata?.aisles) {
			verticalAisles.clear();
			horizontalAisles.clear();
			for (const col of sectorMetadata.aisles.verticalAisles || []) {
				verticalAisles.add(col);
			}
			for (const row of sectorMetadata.aisles.horizontalAisles || []) {
				horizontalAisles.add(row);
			}
			invertRowOrder = sectorMetadata.aisles.invertRowOrder ?? false;
		}

		// Try to infer grid size from existing seats
		let maxRow = 0;
		let maxCol = 0;
		let sawNumericRow = false;
		let sawLetterRow = false;

		for (const seat of existingSeats) {
			let rowIndex = -1;
			let colNum = -1;
			let rowIsNumeric = false;

			// Prefer the explicit row/number fields (row_label, with the transitional
			// `row` alias as fallback) — labels alone are ambiguous for numeric rows
			const rowLabel = seat.row_label ?? seat.row;
			if (rowLabel && seat.number !== null && seat.number !== undefined) {
				rowIndex = parseRowLabelToIndex(rowLabel);
				colNum = seat.number - 1;
				rowIsNumeric = /^\d+$/.test(rowLabel);
			}

			// Fall back to parsing the label ("A1" letter-row or "1-1" numeric-row style)
			if (rowIndex < 0 || colNum < 0) {
				const letterMatch = seat.label.match(/^([A-Z]+)(\d+)$/i);
				const numericMatch = seat.label.match(/^(\d+)-(\d+)$/);
				if (letterMatch) {
					rowIndex = parseRowLabelToIndex(letterMatch[1]);
					colNum = parseInt(letterMatch[2], 10) - 1;
					rowIsNumeric = false;
				} else if (numericMatch) {
					rowIndex = parseRowLabelToIndex(numericMatch[1]);
					colNum = parseInt(numericMatch[2], 10) - 1;
					rowIsNumeric = true;
				}
			}

			if (rowIndex < 0 || colNum < 0) continue;

			if (rowIsNumeric) {
				sawNumericRow = true;
			} else {
				sawLetterRow = true;
			}

			maxRow = Math.max(maxRow, rowIndex);
			maxCol = Math.max(maxCol, colNum);

			// Store seat with its accessibility flags and painted category from
			// the backend (price_category_id, BE #734), so existing paint shows on
			// reload. An undefined (untouched) baseline is never sent on save, so
			// reloading and re-saving a painted venue cannot unpaint anything.
			const persistedPaint = readExistingPaint(seat);
			seats.set(getCellKey(rowIndex, colNum), {
				exists: true,
				is_accessible: seat.is_accessible ?? false,
				is_obstructed_view: seat.is_obstructed_view ?? false,
				...(persistedPaint !== undefined ? { priceCategoryId: persistedPaint } : {})
			});
		}

		// Numeric row labels only round-trip if the label generator stays numeric —
		// otherwise saving would relabel every seat and bulk-delete the originals
		if (sawNumericRow && !sawLetterRow) {
			useLetters = false;
		}

		// Set grid size to accommodate existing seats
		if (existingSeats.length > 0) {
			rows = Math.max(rows, maxRow + 1);
			columns = Math.max(columns, maxCol + 1);
		}

		initialized = true;
	}

	// Generate empty grid
	function generateEmptyGrid() {
		seats.clear();
		selectedCells.clear();
		verticalAisles.clear();
		horizontalAisles.clear();
		initialized = true;
	}

	// Generate full grid (all seats)
	function generateFullGrid() {
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
		for (const key of selectedCells) {
			seats.delete(key);
		}
		selectedCells.clear();
	}

	// Mark selected seats as accessible
	function markSelectedAccessible() {
		for (const key of selectedCells) {
			const seat = seats.get(key);
			if (seat) {
				seats.set(key, { ...seat, is_accessible: !seat.is_accessible });
			}
		}
	}

	// Mark selected seats as obstructed view
	function markSelectedObstructed() {
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

	// Save changes: build the full persistence plan (creates/updates/deletes/
	// paint batches, with explicit row_order/adjacency_index ranks) and hand it
	// to the page, which sequences bulk ops -> paint -> metadata.
	function handleSave() {
		const plan = buildSeatSavePlan({
			cells: seats,
			existingSeats,
			rows,
			invertRowOrder,
			getRowLabel,
			getSeatLabel,
			getXPosition,
			getYPosition
		});

		onPersist(plan, {
			aisles: {
				verticalAisles: [...verticalAisles].sort((a, b) => a - b),
				horizontalAisles: [...horizontalAisles].sort((a, b) => a - b),
				invertRowOrder
			}
		});
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
</script>

<div class="space-y-6">
	<!-- Grid Configuration -->
	<SeatGridConfig
		bind:rows
		bind:columns
		bind:useLetters
		bind:invertRowOrder
		onGenerateEmpty={generateEmptyGrid}
		onGenerateFull={generateFullGrid}
	/>

	<!-- Price category palette (seat painting) -->
	<div class="rounded-lg border bg-card p-4">
		<div class="mb-1 flex items-center gap-2">
			<Paintbrush class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
			<h3 class="font-semibold">{m['seatGridEditor.paint.title']()}</h3>
		</div>

		<!-- What painting achieves — otherwise the palette reads as purely cosmetic. -->
		<p class="mb-1 text-xs text-muted-foreground">
			{m['seatGridEditor.paint.explainer']()}
		</p>
		<!-- Blast radius BEFORE the paint commits (#674): the editor is opened in
		     the context of one event, which is exactly what makes the venue-wide,
		     immediate effect of repainting surprising. -->
		<p class="mb-3 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
			<TriangleAlert class="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
			{m['seatGridEditor.paint.venueWideCaution']()}
		</p>

		{#if priceCategories.length === 0}
			<p class="text-sm text-muted-foreground">
				{m['seatGridEditor.paint.noCategories']()}
			</p>
			<!-- eslint-disable svelte/no-navigation-without-resolve -- href built with resolve() above, plus a hash fragment -->
			<a
				href={manageCategoriesHref}
				class="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
			>
				<Tag class="h-4 w-4" aria-hidden="true" />
				{m['seatGridEditor.paint.manageCategories']()}
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{:else}
			<div
				class="flex flex-wrap items-center gap-2"
				role="group"
				aria-label={m['seatGridEditor.paint.paletteLabel']()}
			>
				{#each priceCategories as category (category.id)}
					{@const categoryId = category.id}
					{#if categoryId}
						{@const isActive = activePaint?.categoryId === categoryId}
						<button
							type="button"
							onclick={() => togglePaint(categoryId)}
							aria-pressed={isActive}
							class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors {isActive
								? 'border-primary bg-primary/10 ring-2 ring-primary ring-offset-1'
								: 'border-input hover:bg-accent'}"
						>
							<span
								class="h-3.5 w-3.5 shrink-0 rounded-full border border-black/20"
								style="background-color: {category.color};"
								aria-hidden="true"
							></span>
							{category.name}
						</button>
					{/if}
				{/each}
				<button
					type="button"
					onclick={() => togglePaint(null)}
					aria-pressed={eraserActive}
					class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors {eraserActive
						? 'border-primary bg-primary/10 ring-2 ring-primary ring-offset-1'
						: 'border-input hover:bg-accent'}"
				>
					<Eraser class="h-3.5 w-3.5" aria-hidden="true" />
					{m['seatGridEditor.paint.unpainted']()}
				</button>
			</div>

			{#if activePaint}
				<p class="mt-2 text-xs text-muted-foreground" role="status">
					{m['seatGridEditor.paint.activeHint']()}
				</p>
			{/if}
		{/if}
	</div>

	<!-- Selection Actions -->
	{#if selectedCount > 0}
		<div class="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
			<span class="text-sm font-medium">
				{m['seatGridEditor.seatsSelected']({
					count: selectedCount,
					plural: selectedCount !== 1 ? 's' : ''
				})}
			</span>
			<div class="flex flex-wrap gap-2">
				<button
					type="button"
					onclick={markSelectedAccessible}
					class="inline-flex items-center gap-1.5 rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
				>
					<Accessibility class="h-4 w-4" />
					{m['seatGridEditor.toggleAccessible']()}
				</button>
				<button
					type="button"
					onclick={markSelectedObstructed}
					class="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300 dark:hover:bg-amber-900"
				>
					<EyeOff class="h-4 w-4" />
					{m['seatGridEditor.toggleObstructed']()}
				</button>
				{#if activePaint}
					<button
						type="button"
						onclick={paintSelected}
						class="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm font-medium hover:bg-accent"
					>
						<Paintbrush class="h-4 w-4" />
						{m['seatGridEditor.paint.applyToSelected']()}
					</button>
				{/if}
				<button
					type="button"
					onclick={deleteSelected}
					class="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
				>
					{m['seatGridEditor.deleteSelected']()}
				</button>
				<button
					type="button"
					onclick={clearSelection}
					class="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent"
				>
					{m['seatGridEditor.clearSelection']()}
				</button>
			</div>
		</div>
	{/if}

	<!-- Grid -->
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
		{activePaint}
		{priceCategories}
	/>

	<!-- Legend & Stats -->
	<div class="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card p-4">
		<div class="flex flex-wrap items-center gap-4 text-sm md:gap-6">
			<div class="flex items-center gap-2">
				<div class="h-6 w-6 rounded bg-green-500"></div>
				<span>{m['seatGridEditor.legendSeat']()}</span>
			</div>
			<div class="flex items-center gap-2">
				<div class="h-6 w-6 rounded border-2 border-muted-foreground/20 bg-muted/20"></div>
				<span>{m['seatGridEditor.legendEmpty']()}</span>
			</div>
			<div class="flex items-center gap-2">
				<div class="h-6 w-6 rounded bg-primary ring-2 ring-primary ring-offset-1"></div>
				<span>{m['seatGridEditor.legendSelected']()}</span>
			</div>
			<div class="flex items-center gap-2">
				<div class="h-6 w-6 rounded bg-amber-500/30 dark:bg-amber-400/20"></div>
				<span>{m['seatGridEditor.legendAisle']()}</span>
			</div>
			<div class="flex items-center gap-2">
				<Accessibility class="h-4 w-4 text-blue-500" />
				<span>{m['seatGridEditor.legendAccessible']()}</span>
			</div>
			<div class="flex items-center gap-2">
				<EyeOff class="h-4 w-4 text-amber-500" />
				<span>{m['seatGridEditor.legendObstructed']()}</span>
			</div>
			{#if priceCategories.length > 0}
				<div class="flex items-center gap-2">
					<div class="flex overflow-hidden rounded" aria-hidden="true">
						{#each priceCategories.slice(0, 3) as category (category.id)}
							<div class="h-6 w-2" style="background-color: {category.color};"></div>
						{/each}
					</div>
					<span>
						{m['seatGridEditor.legendPainted']()}
					</span>
				</div>
			{/if}
		</div>

		<div class="text-sm text-muted-foreground">
			{m['seatGridEditor.totalLabel']()}
			<strong>{totalSeats}</strong>
			{m['seatGridEditor.totalSeatsSuffix']({ plural: totalSeats !== 1 ? 's' : '' })}
		</div>
	</div>

	<!-- Save Button -->
	<div class="flex justify-end">
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
