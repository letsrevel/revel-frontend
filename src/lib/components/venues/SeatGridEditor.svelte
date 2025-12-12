<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type {
		VenueSeatSchema,
		VenueSeatInputSchema,
		VenueSeatBulkUpdateItemSchema
	} from '$lib/api/generated/types.gen';
	import { Plus, Accessibility, EyeOff } from 'lucide-svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';

	// Aisle metadata structure stored in sector
	export interface AisleMetadata {
		verticalAisles: number[]; // Column indices after which aisles appear
		horizontalAisles: number[]; // Row indices after which aisles appear
		invertRowOrder: boolean; // If true, row A is at the bottom
	}

	interface Props {
		existingSeats: VenueSeatSchema[];
		sectorMetadata?: { aisles?: AisleMetadata } | null;
		onSave: (seats: VenueSeatInputSchema[]) => void;
		onUpdate: (seats: VenueSeatBulkUpdateItemSchema[]) => void;
		onDelete: (labels: string[]) => void;
		onMetadataChange: (metadata: { aisles: AisleMetadata }) => void;
		isSaving: boolean;
	}

	let {
		existingSeats,
		sectorMetadata,
		onSave,
		onUpdate,
		onDelete,
		onMetadataChange,
		isSaving
	}: Props = $props();

	// Grid configuration
	let rows = $state(10);
	let columns = $state(10);
	let useLetters = $state(true);
	let invertRowOrder = $state(false);

	// Aisle configuration (column/row indices after which aisles appear)
	let verticalAisles = $state(new SvelteSet<number>());
	let horizontalAisles = $state(new SvelteSet<number>());

	// Hover state for aisle insertion UI
	let hoveredRowAisle = $state<number | null>(null);
	let hoveredColAisle = $state<number | null>(null);

	// Seat state: Map of "row-col" -> seat metadata
	interface SeatData {
		exists: boolean;
		is_accessible: boolean;
		is_obstructed_view: boolean;
	}
	let seats = $state(new SvelteMap<string, SeatData>());

	// Selection state
	let selectedCells = $state(new SvelteSet<string>());
	let isSelecting = $state(false);
	let selectionStart = $state<{ row: number; col: number } | null>(null);
	let selectionEnd = $state<{ row: number; col: number } | null>(null);

	// Track if grid has been initialized
	let initialized = $state(false);

	// Get the display row index (accounts for inversion)
	function getDisplayRowIndex(index: number): number {
		return invertRowOrder ? rows - 1 - index : index;
	}

	// Get the logical row index from display index
	function getLogicalRowIndex(displayIndex: number): number {
		return invertRowOrder ? rows - 1 - displayIndex : displayIndex;
	}

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

		for (const seat of existingSeats) {
			// Parse label to get row and column
			const match = seat.label.match(/^([A-Z]+)(\d+)$/i);
			if (match) {
				const rowLabel = match[1].toUpperCase();
				const colNum = parseInt(match[2], 10) - 1;

				// Convert row label to index
				let rowIndex = 0;
				for (let i = 0; i < rowLabel.length; i++) {
					rowIndex = rowIndex * 26 + (rowLabel.charCodeAt(i) - 64);
				}
				rowIndex--;

				maxRow = Math.max(maxRow, rowIndex);
				maxCol = Math.max(maxCol, colNum);

				// Store seat with its accessibility flags from backend
				seats.set(getCellKey(rowIndex, colNum), {
					exists: true,
					is_accessible: seat.is_accessible ?? false,
					is_obstructed_view: seat.is_obstructed_view ?? false
				});
			}
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

	// Toggle single seat (adds if not exists, removes if exists)
	function toggleSeat(row: number, col: number) {
		const key = getCellKey(row, col);
		const seat = seats.get(key);
		if (seat?.exists) {
			seats.delete(key);
		} else {
			seats.set(key, { exists: true, is_accessible: false, is_obstructed_view: false });
		}
	}

	// Toggle single seat selection (for clicking on existing seats)
	function selectSeat(row: number, col: number) {
		const key = getCellKey(row, col);
		if (selectedCells.has(key)) {
			selectedCells.delete(key);
		} else {
			selectedCells.add(key);
		}
	}

	// Handle cell click
	function handleCellClick(row: number, col: number, event: MouseEvent) {
		// If we were dragging, the drag handler already processed this
		if (isSelecting) return;

		const key = getCellKey(row, col);
		const seat = seats.get(key);

		if (seat?.exists) {
			// Clicking on existing seat: add to selection
			selectSeat(row, col);
		} else {
			// Clicking on empty cell: add a seat (don't clear selection)
			seats.set(key, { exists: true, is_accessible: false, is_obstructed_view: false });
		}
	}

	// Handle mouse down - start potential drag selection
	function handleMouseDown(row: number, col: number, event: MouseEvent) {
		if (event.button !== 0) return;

		// Store start position for potential drag
		selectionStart = { row, col };
		selectionEnd = { row, col };
		// Don't set isSelecting yet - only set it if mouse moves to different cell
		// Don't clear selection - let clicks accumulate
	}

	// Handle mouse move - update selection (only start drag if moved to different cell)
	function handleMouseMove(row: number, col: number) {
		if (!selectionStart) return;

		// Only start drag selection if mouse moved to a different cell
		if (!isSelecting && (row !== selectionStart.row || col !== selectionStart.col)) {
			isSelecting = true;
		}

		if (isSelecting) {
			selectionEnd = { row, col };
		}
	}

	// Handle mouse up - finalize drag selection (if any)
	function handleMouseUp() {
		// If we weren't dragging, just reset and let click handler work
		if (!isSelecting) {
			selectionStart = null;
			selectionEnd = null;
			return;
		}

		// We were dragging - finalize the selection
		if (!selectionStart || !selectionEnd) {
			isSelecting = false;
			selectionStart = null;
			selectionEnd = null;
			return;
		}

		// Calculate selection rectangle
		const minRow = Math.min(selectionStart.row, selectionEnd.row);
		const maxRow = Math.max(selectionStart.row, selectionEnd.row);
		const minCol = Math.min(selectionStart.col, selectionEnd.col);
		const maxCol = Math.max(selectionStart.col, selectionEnd.col);

		// Check if both start and end cells are empty
		const startKey = getCellKey(selectionStart.row, selectionStart.col);
		const endKey = getCellKey(selectionEnd.row, selectionEnd.col);
		const startEmpty = !seats.get(startKey)?.exists;
		const endEmpty = !seats.get(endKey)?.exists;

		if (startEmpty && endEmpty) {
			// Fill the selection rectangle with seats
			for (let r = minRow; r <= maxRow; r++) {
				for (let c = minCol; c <= maxCol; c++) {
					seats.set(getCellKey(r, c), {
						exists: true,
						is_accessible: false,
						is_obstructed_view: false
					});
				}
			}
		} else {
			// Select all cells in rectangle that have seats (add to existing selection)
			for (let r = minRow; r <= maxRow; r++) {
				for (let c = minCol; c <= maxCol; c++) {
					const key = getCellKey(r, c);
					if (seats.get(key)?.exists) {
						selectedCells.add(key);
					}
				}
			}
		}

		isSelecting = false;
		selectionStart = null;
		selectionEnd = null;
	}

	// Check if cell is in current selection rectangle
	function isInSelectionRect(row: number, col: number): boolean {
		if (!isSelecting || !selectionStart || !selectionEnd) return false;

		const minRow = Math.min(selectionStart.row, selectionEnd.row);
		const maxRow = Math.max(selectionStart.row, selectionEnd.row);
		const minCol = Math.min(selectionStart.col, selectionEnd.col);
		const maxCol = Math.max(selectionStart.col, selectionEnd.col);

		return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol;
	}

	// Delete selected seats
	function deleteSelected() {
		for (const key of selectedCells) {
			seats.delete(key);
		}
		selectedCells.clear();
	}

	// Add selected cells as seats
	function addSelectedAsSeats() {
		if (!isSelecting || !selectionStart || !selectionEnd) return;

		const minRow = Math.min(selectionStart.row, selectionEnd.row);
		const maxRow = Math.max(selectionStart.row, selectionEnd.row);
		const minCol = Math.min(selectionStart.col, selectionEnd.col);
		const maxCol = Math.max(selectionStart.col, selectionEnd.col);

		for (let r = minRow; r <= maxRow; r++) {
			for (let c = minCol; c <= maxCol; c++) {
				seats.set(getCellKey(r, c), {
					exists: true,
					is_accessible: false,
					is_obstructed_view: false
				});
			}
		}
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

	// Toggle vertical aisle (for clicking on existing aisle indicator)
	function toggleVerticalAisle(col: number) {
		if (verticalAisles.has(col)) {
			verticalAisles.delete(col);
		} else {
			verticalAisles.add(col);
		}
	}

	// Toggle horizontal aisle (for clicking on existing aisle indicator)
	function toggleHorizontalAisle(row: number) {
		if (horizontalAisles.has(row)) {
			horizontalAisles.delete(row);
		} else {
			horizontalAisles.add(row);
		}
	}

	// Add vertical aisle at position (inserts between columns)
	function addVerticalAisle(afterCol: number) {
		verticalAisles.add(afterCol);
	}

	// Add horizontal aisle at position (inserts between rows)
	function addHorizontalAisle(afterRow: number) {
		horizontalAisles.add(afterRow);
	}

	// Remove vertical aisle
	function removeVerticalAisle(col: number) {
		verticalAisles.delete(col);
	}

	// Remove horizontal aisle
	function removeHorizontalAisle(row: number) {
		horizontalAisles.delete(row);
	}

	// Clear selection
	function clearSelection() {
		selectedCells.clear();
	}

	// Get all seats as API format
	function getAllSeatsForApi(): VenueSeatInputSchema[] {
		const result: VenueSeatInputSchema[] = [];

		for (const [key, seatData] of seats) {
			if (!seatData.exists) continue;

			const [row, col] = key.split('-').map(Number);
			const label = getSeatLabel(row, col);

			result.push({
				label,
				row: getRowLabel(row),
				number: col + 1,
				position: {
					x: getXPosition(col),
					y: getYPosition(row)
				},
				is_accessible: seatData.is_accessible,
				is_obstructed_view: seatData.is_obstructed_view,
				is_active: true
			});
		}

		return result;
	}

	// Save changes
	function handleSave() {
		const allSeats = getAllSeatsForApi();
		const existingLabels = new Set(existingSeats.map((s) => s.label));
		const newLabels = new Set(allSeats.map((s) => s.label));

		// Separate into new seats (to create) and existing seats (to update)
		const seatsToCreate: VenueSeatInputSchema[] = [];
		const seatsToUpdate: VenueSeatBulkUpdateItemSchema[] = [];

		for (const seat of allSeats) {
			if (existingLabels.has(seat.label)) {
				// This seat exists, needs update (position may have changed due to aisles)
				seatsToUpdate.push({
					label: seat.label,
					row: seat.row,
					number: seat.number,
					position: seat.position,
					is_accessible: seat.is_accessible,
					is_obstructed_view: seat.is_obstructed_view,
					is_active: seat.is_active
				});
			} else {
				// This is a new seat
				seatsToCreate.push(seat);
			}
		}

		// Labels to delete (exist in backend but not in current grid)
		const toDelete = [...existingLabels].filter((l) => !newLabels.has(l));

		// Create new seats
		if (seatsToCreate.length > 0) {
			onSave(seatsToCreate);
		}

		// Update existing seats (for position changes due to aisles)
		if (seatsToUpdate.length > 0) {
			onUpdate(seatsToUpdate);
		}

		// Delete removed seats
		if (toDelete.length > 0) {
			onDelete(toDelete);
		}

		// Save metadata (aisles and row order)
		onMetadataChange({
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

	// Get cell class
	function getCellClass(row: number, col: number): string {
		const key = getCellKey(row, col);
		const seatData = seats.get(key);
		const hasSeat = seatData?.exists ?? false;
		const isSelected = selectedCells.has(key);
		const inRect = isInSelectionRect(row, col);

		const base =
			'w-10 h-10 rounded transition-all duration-75 flex items-center justify-center text-xs font-medium select-none';

		if (isSelected) {
			return `${base} bg-primary text-primary-foreground ring-2 ring-primary ring-offset-1`;
		}

		if (inRect) {
			return `${base} ${hasSeat ? 'bg-primary/70 text-primary-foreground' : 'bg-primary/30'} ring-1 ring-primary`;
		}

		if (hasSeat) {
			return `${base} bg-green-500 hover:bg-green-600 text-white cursor-pointer`;
		}

		// Empty cell - visible border in both light and dark mode
		return `${base} bg-muted/20 hover:bg-muted/40 border-2 border-muted-foreground/20 hover:border-muted-foreground/40 text-muted-foreground/30 cursor-pointer`;
	}

	// Initialize on mount
	$effect(() => {
		if (!initialized && existingSeats) {
			initializeFromExisting();
		}
	});
</script>

<svelte:window onmouseup={handleMouseUp} />

<div class="space-y-6">
	<!-- Grid Configuration -->
	<div class="rounded-lg border bg-card p-4">
		<h3 class="mb-4 font-semibold">{m['orgAdmin.seats.grid.title']()}</h3>

		<div class="flex flex-wrap items-end gap-4">
			<div>
				<label for="grid-rows" class="mb-1.5 block text-sm font-medium">
					{m['orgAdmin.seats.grid.rowsLabel']()}
				</label>
				<input
					id="grid-rows"
					type="number"
					min="1"
					max="30"
					bind:value={rows}
					class="w-20 rounded-md border border-input bg-background px-3 py-2 text-sm"
				/>
			</div>

			<div>
				<label for="grid-cols" class="mb-1.5 block text-sm font-medium">
					{m['orgAdmin.seats.grid.columnsLabel']()}
				</label>
				<input
					id="grid-cols"
					type="number"
					min="1"
					max="30"
					bind:value={columns}
					class="w-20 rounded-md border border-input bg-background px-3 py-2 text-sm"
				/>
			</div>

			<div>
				<label for="row-prefix" class="mb-1.5 block text-sm font-medium">
					{m['orgAdmin.seats.grid.rowPrefixLabel']()}
				</label>
				<select
					id="row-prefix"
					bind:value={useLetters}
					class="rounded-md border border-input bg-background px-3 py-2 text-sm"
				>
					<option value={true}>A, B, C...</option>
					<option value={false}>1, 2, 3...</option>
				</select>
			</div>

			<div>
				<label for="row-order" class="mb-1.5 block text-sm font-medium"> Row Order </label>
				<select
					id="row-order"
					bind:value={invertRowOrder}
					class="rounded-md border border-input bg-background px-3 py-2 text-sm"
				>
					<option value={false}>{useLetters ? 'A' : '1'} at top (standard)</option>
					<option value={true}>{useLetters ? 'A' : '1'} at bottom (inverted)</option>
				</select>
			</div>

			<div class="flex gap-2">
				<button
					type="button"
					onclick={generateEmptyGrid}
					class="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent"
				>
					Empty Grid
				</button>
				<button
					type="button"
					onclick={generateFullGrid}
					class="rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
				>
					Fill All
				</button>
			</div>
		</div>

		<p class="mt-3 text-sm text-muted-foreground">
			Click cells to toggle seats. Drag from empty to empty to fill area with seats. Hover between
			labels to add aisles.
		</p>
	</div>

	<!-- Selection Actions -->
	{#if selectedCount > 0}
		<div class="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
			<span class="text-sm font-medium">
				{selectedCount} seat{selectedCount !== 1 ? 's' : ''} selected
			</span>
			<div class="flex flex-wrap gap-2">
				<button
					type="button"
					onclick={markSelectedAccessible}
					class="inline-flex items-center gap-1.5 rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
				>
					<Accessibility class="h-4 w-4" />
					Toggle Accessible
				</button>
				<button
					type="button"
					onclick={markSelectedObstructed}
					class="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300 dark:hover:bg-amber-900"
				>
					<EyeOff class="h-4 w-4" />
					Toggle Obstructed
				</button>
				<button
					type="button"
					onclick={deleteSelected}
					class="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
				>
					Delete Selected
				</button>
				<button
					type="button"
					onclick={clearSelection}
					class="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent"
				>
					Clear Selection
				</button>
			</div>
		</div>
	{/if}

	<!-- Grid -->
	<div class="overflow-x-auto rounded-lg border bg-card p-4">
		<div class="inline-block">
			<!-- Stage Indicator (above column headers, centered with grid) -->
			<div class="mb-4 flex">
				<!-- Offset for row labels -->
				<div class="w-14 shrink-0"></div>
				<!-- Stage centered over columns -->
				<div class="flex flex-1 justify-center">
					<div class="rounded-lg bg-muted px-8 py-2 text-sm font-medium text-muted-foreground">
						STAGE
					</div>
				</div>
			</div>

			<!-- Column Headers -->
			<div class="flex items-end">
				<!-- Corner space for row labels + aisle zone -->
				<div class="h-12 w-14"></div>
				{#each Array(columns) as _, c (c)}
					{@const colIndex = c}
					<!-- Aisle indicator/insertion zone before this column (except first) -->
					{#if colIndex > 0}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="group relative flex h-12 w-2 cursor-pointer items-center justify-center hover:w-5"
							onmouseenter={() => (hoveredColAisle = colIndex - 1)}
							onmouseleave={() => (hoveredColAisle = null)}
						>
							{#if verticalAisles.has(colIndex - 1)}
								<button
									type="button"
									onclick={() => removeVerticalAisle(colIndex - 1)}
									class="flex h-full w-5 items-center justify-center text-xs text-primary hover:text-destructive"
									title="Remove aisle after column {colIndex}"
								>
									|
								</button>
							{:else}
								<button
									type="button"
									onclick={() => addVerticalAisle(colIndex - 1)}
									class="hidden h-6 w-5 items-center justify-center rounded bg-primary/10 text-primary opacity-0 transition-opacity group-hover:flex group-hover:opacity-100"
									title="Add aisle after column {colIndex}"
								>
									<Plus class="h-3 w-3" />
								</button>
							{/if}
						</div>
					{/if}
					<div class="flex h-12 w-10 flex-col items-center justify-end">
						<div
							class="flex h-8 w-10 items-center justify-center text-xs font-medium text-muted-foreground"
						>
							{colIndex + 1}
						</div>
					</div>
				{/each}
			</div>

			<!-- Rows (with logical index accounting for inversion) -->
			{#each Array(rows) as _, displayIndex (displayIndex)}
				{@const logicalRow = invertRowOrder ? rows - 1 - displayIndex : displayIndex}

				<!-- Aisle insertion zone between rows (at left edge only) -->
				{#if displayIndex > 0}
					{@const prevLogicalRow = invertRowOrder ? rows - displayIndex : displayIndex - 1}
					{@const aisleAfterRow = invertRowOrder ? logicalRow : prevLogicalRow}
					{@const hasHorizontalAisle = horizontalAisles.has(aisleAfterRow)}
					{@const aisleHeight = hasHorizontalAisle ? 'h-5' : 'h-2'}
					<div class="flex items-center {aisleHeight}">
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="group flex w-14 cursor-pointer items-center justify-center {hasHorizontalAisle
								? 'h-5'
								: 'h-2 hover:h-6'}"
							onmouseenter={() => (hoveredRowAisle = aisleAfterRow)}
							onmouseleave={() => (hoveredRowAisle = null)}
						>
							{#if hasHorizontalAisle}
								<button
									type="button"
									onclick={() => removeHorizontalAisle(aisleAfterRow)}
									class="flex h-5 w-full items-center justify-center text-xs text-amber-600 hover:text-destructive dark:text-amber-400"
									title="Remove aisle after row {getRowLabel(aisleAfterRow)}"
								>
									—
								</button>
							{:else}
								<button
									type="button"
									onclick={() => addHorizontalAisle(aisleAfterRow)}
									class="hidden h-6 w-full items-center justify-center rounded bg-primary/10 text-primary opacity-0 transition-opacity group-hover:flex group-hover:opacity-100"
									title="Add aisle after row {getRowLabel(aisleAfterRow)}"
								>
									<Plus class="h-3 w-3" />
								</button>
							{/if}
						</div>
						<!-- Row gap with matching column structure for continuous vertical aisles -->
						{#each Array(columns) as _, c (c)}
							{#if c > 0 && verticalAisles.has(c - 1)}
								<!-- Vertical aisle continues through this gap -->
								<div
									class="w-5 {aisleHeight} {hasHorizontalAisle
										? 'bg-amber-500/50 dark:bg-amber-400/30'
										: 'bg-amber-500/30 dark:bg-amber-400/20'}"
								></div>
							{:else if c > 0}
								<!-- Regular spacer -->
								<div
									class="w-2 {aisleHeight} {hasHorizontalAisle
										? 'bg-amber-500/30 dark:bg-amber-400/20'
										: ''}"
								></div>
							{/if}
							<!-- Cell-width space -->
							<div
								class="w-10 {aisleHeight} {hasHorizontalAisle
									? 'bg-amber-500/30 dark:bg-amber-400/20'
									: ''}"
							></div>
						{/each}
					</div>
				{/if}

				<div class="flex items-center gap-0">
					<!-- Row Label -->
					<div
						class="flex h-10 w-14 items-center justify-center text-xs font-medium text-muted-foreground"
					>
						{getRowLabel(logicalRow)}
					</div>

					<!-- Cells -->
					{#each Array(columns) as _, c (c)}
						<!-- Spacer for vertical aisle (before this cell, except first) -->
						{#if c > 0 && verticalAisles.has(c - 1)}
							<div class="h-10 w-5 bg-amber-500/30 dark:bg-amber-400/20"></div>
						{:else if c > 0}
							<div class="w-2"></div>
						{/if}
						{@const cellKey = getCellKey(logicalRow, c)}
						{@const seatData = seats.get(cellKey)}
						<button
							type="button"
							class="{getCellClass(logicalRow, c)} relative"
							onmousedown={(e) => handleMouseDown(logicalRow, c, e)}
							onmouseenter={() => handleMouseMove(logicalRow, c)}
							onclick={(e) => handleCellClick(logicalRow, c, e)}
							aria-label="Seat {getSeatLabel(logicalRow, c)}{seatData?.is_accessible
								? ', accessible'
								: ''}{seatData?.is_obstructed_view ? ', obstructed view' : ''}"
						>
							{#if seatData?.exists}
								<span class="text-[10px]">{getSeatLabel(logicalRow, c)}</span>
								<!-- Indicator icons -->
								{#if seatData.is_accessible || seatData.is_obstructed_view}
									<div
										class="absolute -bottom-1 -right-1 flex gap-0.5 rounded bg-white/90 p-0.5 shadow-sm dark:bg-gray-900/90"
									>
										{#if seatData.is_accessible}
											<Accessibility class="h-3 w-3 text-blue-600" />
										{/if}
										{#if seatData.is_obstructed_view}
											<EyeOff class="h-3 w-3 text-amber-600" />
										{/if}
									</div>
								{/if}
							{/if}
						</button>
					{/each}
				</div>
			{/each}
		</div>
	</div>

	<!-- Legend & Stats -->
	<div class="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card p-4">
		<div class="flex flex-wrap items-center gap-4 text-sm md:gap-6">
			<div class="flex items-center gap-2">
				<div class="h-6 w-6 rounded bg-green-500"></div>
				<span>Seat</span>
			</div>
			<div class="flex items-center gap-2">
				<div class="h-6 w-6 rounded border-2 border-muted-foreground/20 bg-muted/20"></div>
				<span>Empty</span>
			</div>
			<div class="flex items-center gap-2">
				<div class="h-6 w-6 rounded bg-primary ring-2 ring-primary ring-offset-1"></div>
				<span>Selected</span>
			</div>
			<div class="flex items-center gap-2">
				<div class="h-6 w-6 rounded bg-amber-500/30 dark:bg-amber-400/20"></div>
				<span>Aisle</span>
			</div>
			<div class="flex items-center gap-2">
				<Accessibility class="h-4 w-4 text-blue-500" />
				<span>Accessible</span>
			</div>
			<div class="flex items-center gap-2">
				<EyeOff class="h-4 w-4 text-amber-500" />
				<span>Obstructed</span>
			</div>
		</div>

		<div class="text-sm text-muted-foreground">
			Total: <strong>{totalSeats}</strong> seat{totalSeats !== 1 ? 's' : ''}
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
