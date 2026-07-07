<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type {
		VenueSeatSchema,
		VenueSeatInputSchema,
		VenueSeatBulkUpdateItemSchema
	} from '$lib/api/generated/types.gen';
	import { Accessibility, EyeOff } from '@lucide/svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import type { SeatData } from './seat-grid-types';
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
		onSave: (seats: VenueSeatInputSchema[]) => void;
		onUpdate: (seats: VenueSeatBulkUpdateItemSchema[]) => void;
		onDelete: (labels: string[]) => void;
		onMetadataChange: (metadata: { aisles: AisleMetadata }) => void;
		isSaving: boolean;
	}

	const {
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
