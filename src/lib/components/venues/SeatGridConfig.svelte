<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		rows: number;
		columns: number;
		useLetters: boolean;
		invertRowOrder: boolean;
		onGenerateEmpty: () => void;
		onGenerateFull: () => void;
	}

	let {
		rows = $bindable(),
		columns = $bindable(),
		useLetters = $bindable(),
		invertRowOrder = $bindable(),
		onGenerateEmpty,
		onGenerateFull
	}: Props = $props();
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
			<label for="row-order" class="mb-1.5 block text-sm font-medium">
				{m['seatGridEditor.rowOrder']()}
			</label>
			<select
				id="row-order"
				bind:value={invertRowOrder}
				class="rounded-md border border-input bg-background px-3 py-2 text-sm"
			>
				<option value={false}
					>{m['seatGridEditor.rowOrderTop']({ label: useLetters ? 'A' : '1' })}</option
				>
				<option value={true}
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
