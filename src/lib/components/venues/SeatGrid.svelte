<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Plus, Accessibility, EyeOff } from '@lucide/svelte';
	import type { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import type { SeatData } from './seat-grid-types';

	interface Props {
		seats: SvelteMap<string, SeatData>;
		selectedCells: SvelteSet<string>;
		verticalAisles: SvelteSet<number>;
		horizontalAisles: SvelteSet<number>;
		rows: number;
		columns: number;
		invertRowOrder: boolean;
		getRowLabel: (index: number) => string;
		getSeatLabel: (rowIndex: number, colIndex: number) => string;
		getCellKey: (row: number, col: number) => string;
	}

	const {
		seats,
		selectedCells,
		verticalAisles,
		horizontalAisles,
		rows,
		columns,
		invertRowOrder,
		getRowLabel,
		getSeatLabel,
		getCellKey
	}: Props = $props();

	// Selection state
	let isSelecting = $state(false);
	let selectionStart = $state<{ row: number; col: number } | null>(null);
	let selectionEnd = $state<{ row: number; col: number } | null>(null);

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
	function handleCellClick(row: number, col: number) {
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
</script>

<svelte:window onmouseup={handleMouseUp} />

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
					{m['seatGridEditor.stage']()}
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
					<div
						class="group relative flex h-12 w-2 cursor-pointer items-center justify-center hover:w-5"
					>
						{#if verticalAisles.has(colIndex - 1)}
							<button
								type="button"
								onclick={() => removeVerticalAisle(colIndex - 1)}
								class="flex h-full w-5 items-center justify-center text-xs text-primary hover:text-destructive"
								title={m['seatGridEditor.removeAisleAfterColumn']({ column: colIndex })}
							>
								|
							</button>
						{:else}
							<button
								type="button"
								onclick={() => addVerticalAisle(colIndex - 1)}
								class="hidden h-6 w-5 items-center justify-center rounded bg-primary/10 text-primary opacity-0 transition-opacity group-hover:flex group-hover:opacity-100"
								title={m['seatGridEditor.addAisleAfterColumn']({ column: colIndex })}
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
					<div
						class="group flex w-14 cursor-pointer items-center justify-center {hasHorizontalAisle
							? 'h-5'
							: 'h-2 hover:h-6'}"
					>
						{#if hasHorizontalAisle}
							<button
								type="button"
								onclick={() => removeHorizontalAisle(aisleAfterRow)}
								class="flex h-5 w-full items-center justify-center text-xs text-amber-600 hover:text-destructive dark:text-amber-400"
								title={m['seatGridEditor.removeAisleAfterRow']({
									row: getRowLabel(aisleAfterRow)
								})}
							>
								—
							</button>
						{:else}
							<button
								type="button"
								onclick={() => addHorizontalAisle(aisleAfterRow)}
								class="hidden h-6 w-full items-center justify-center rounded bg-primary/10 text-primary opacity-0 transition-opacity group-hover:flex group-hover:opacity-100"
								title={m['seatGridEditor.addAisleAfterRow']({ row: getRowLabel(aisleAfterRow) })}
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
						onclick={() => handleCellClick(logicalRow, c)}
						aria-label={m['seatGridEditor.seatLabel']({
							seat: getSeatLabel(logicalRow, c),
							accessible: seatData?.is_accessible ? m['seatGridEditor.seatAccessibleSuffix']() : '',
							obstructed: seatData?.is_obstructed_view
								? m['seatGridEditor.seatObstructedSuffix']()
								: ''
						})}
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
