<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { numericField } from '$lib/utils/numeric-input.svelte';

	interface Props {
		rows: number;
		columns: number;
		useLetters: boolean;
		invertRowOrder: boolean;
		onGenerateEmpty: () => void;
		onGenerateFull: () => void;
		/**
		 * Record an undo point BEFORE the write. These controls are written
		 * explicitly rather than with `bind:` precisely so the history entry is
		 * guaranteed to be captured before the value changes — with a binding,
		 * the order of the two input listeners is not ours to decide.
		 */
		onBeforeEdit?: (coalesceKey?: string) => void;
		/**
		 * Fired AFTER `invertRowOrder` flipped. The rank space every row-addressed
		 * geometry entry lives in flips with it, so the editor has to mirror them.
		 */
		onRowOrderChange?: () => void;
	}

	let {
		rows = $bindable(),
		columns = $bindable(),
		useLetters = $bindable(),
		invertRowOrder = $bindable(),
		onGenerateEmpty,
		onGenerateFull,
		onBeforeEdit,
		onRowOrderChange
	}: Props = $props();

	/** The inputs' declared bound — typed values must honor it too, or a stray
	 *  digit ("300") explodes the synthetic lattice the editor bakes per cell. */
	const MAX_GRID_SIZE = 30;

	// Typing through an empty field must not blank the grid size, and an emptied
	// field must not be left showing a size the grid doesn't have: only in-range
	// sizes are committed while typing, and blur settles the rest (#924). The undo
	// point is recorded from `commit`, so a keystroke that changes nothing (an
	// empty field, a half-typed "3" of "30") no longer opens a history entry.
	const rowsField = numericField({
		value: () => rows,
		commit: (next) => {
			onBeforeEdit?.('grid-size');
			rows = next;
		},
		min: 1,
		max: MAX_GRID_SIZE
	});

	const columnsField = numericField({
		value: () => columns,
		commit: (next) => {
			onBeforeEdit?.('grid-size');
			columns = next;
		},
		min: 1,
		max: MAX_GRID_SIZE
	});
</script>

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
				max={MAX_GRID_SIZE}
				value={rowsField.value}
				oninput={rowsField.oninput}
				onblur={rowsField.onblur}
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
				max={MAX_GRID_SIZE}
				value={columnsField.value}
				oninput={columnsField.oninput}
				onblur={columnsField.onblur}
				class="w-20 rounded-md border border-input bg-background px-3 py-2 text-sm"
			/>
		</div>

		<div>
			<label for="row-prefix" class="mb-1.5 block text-sm font-medium">
				{m['orgAdmin.seats.grid.rowPrefixLabel']()}
			</label>
			<select
				id="row-prefix"
				value={useLetters ? 'letters' : 'numbers'}
				onchange={(e) => {
					onBeforeEdit?.();
					useLetters = e.currentTarget.value === 'letters';
				}}
				class="rounded-md border border-input bg-background px-3 py-2 text-sm"
			>
				<option value="letters">A, B, C...</option>
				<option value="numbers">1, 2, 3...</option>
			</select>
		</div>

		<div>
			<label for="row-order" class="mb-1.5 block text-sm font-medium">
				{m['seatGridEditor.rowOrder']()}
			</label>
			<select
				id="row-order"
				value={invertRowOrder ? 'bottom' : 'top'}
				onchange={(e) => {
					onBeforeEdit?.();
					invertRowOrder = e.currentTarget.value === 'bottom';
					onRowOrderChange?.();
				}}
				class="rounded-md border border-input bg-background px-3 py-2 text-sm"
			>
				<option value="top"
					>{m['seatGridEditor.rowOrderTop']({ label: useLetters ? 'A' : '1' })}</option
				>
				<option value="bottom"
					>{m['seatGridEditor.rowOrderBottom']({ label: useLetters ? 'A' : '1' })}</option
				>
			</select>
		</div>

		<div class="flex gap-2">
			<button
				type="button"
				onclick={onGenerateEmpty}
				class="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent"
			>
				{m['seatGridEditor.emptyGrid']()}
			</button>
			<button
				type="button"
				onclick={onGenerateFull}
				class="rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
			>
				{m['seatGridEditor.fillAll']()}
			</button>
		</div>
	</div>

	<p class="mt-3 text-sm text-muted-foreground">
		{m['seatGridEditor.instructions']()}
	</p>
</div>
