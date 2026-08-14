<script lang="ts">
	/**
	 * The seat editor's persistent toolbar: the "Adjust seats" mode switch
	 * (always first, so it's reachable before any selection exists) plus, only
	 * while a normal-mode selection exists AND adjust mode is off, the bulk
	 * actions for it (accessible/obstructed flags, paint, delete, clear).
	 *
	 * Selection-dependent controls hide during adjust mode: adjust mode's own
	 * click semantics never add to `selectedCells` (see SeatGrid's
	 * `handleCellClick`), so a bulk-selection left over from before the mode
	 * was switched on would otherwise show stale, inert-looking controls here.
	 *
	 * A dumb view — every mutation, and its undo point, belongs to the editor.
	 */
	import * as m from '$lib/paraglide/messages.js';
	import { Accessibility, EyeOff, Move, Paintbrush, Plus } from '@lucide/svelte';
	import type { SeatAdjustState } from './seat-adjust-state.svelte';

	interface Props {
		adjust: SeatAdjustState;
		count: number;
		/** True while a paint chip is armed — only then can the selection be painted. */
		canPaint: boolean;
		onToggleAccessible: () => void;
		onToggleObstructed: () => void;
		onPaint: () => void;
		onDelete: () => void;
		onClear: () => void;
	}

	const {
		adjust,
		count,
		canPaint,
		onToggleAccessible,
		onToggleObstructed,
		onPaint,
		onDelete,
		onClear
	}: Props = $props();
</script>

<div class="space-y-2 rounded-lg border bg-card p-3">
	<div class="flex flex-wrap items-center gap-3">
		<button
			type="button"
			data-testid="adjust-mode-toggle"
			aria-pressed={adjust.active}
			onclick={() => adjust.toggleActive()}
			class="inline-flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 {adjust.active
				? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90'
				: 'border-input hover:bg-accent'}"
		>
			<Move class="h-4 w-4" aria-hidden="true" />
			{m['seatGridEditor.adjust.toggle']()}
		</button>

		{#if adjust.active}
			<button
				type="button"
				data-testid="adjust-add-seat-toggle"
				aria-pressed={adjust.addArmed}
				onclick={() => adjust.setAddArmed(!adjust.addArmed)}
				class="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 {adjust.addArmed
					? 'border-primary bg-primary/10 ring-2 ring-primary ring-offset-1'
					: 'border-input hover:bg-accent'}"
			>
				<Plus class="h-4 w-4" aria-hidden="true" />
				{m['seatGridEditor.adjust.addSeat']()}
			</button>
		{/if}

		{#if count > 0 && !adjust.active}
			<span class="text-sm font-medium">
				{m['seatGridEditor.seatsSelected']({ count })}
			</span>
			<div class="flex flex-wrap gap-2">
				<button
					type="button"
					onclick={onToggleAccessible}
					class="inline-flex items-center gap-1.5 rounded-md border border-info/40 bg-info/10 px-3 py-1.5 text-sm font-medium text-info hover:bg-info/20"
				>
					<Accessibility class="h-4 w-4" />
					{m['seatGridEditor.toggleAccessible']()}
				</button>
				<button
					type="button"
					onclick={onToggleObstructed}
					class="inline-flex items-center gap-1.5 rounded-md border border-highlight/60 bg-highlight/10 px-3 py-1.5 text-sm font-medium text-highlight-foreground hover:bg-highlight/20 dark:text-highlight"
				>
					<EyeOff class="h-4 w-4" />
					{m['seatGridEditor.toggleObstructed']()}
				</button>
				{#if canPaint}
					<button
						type="button"
						onclick={onPaint}
						class="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm font-medium hover:bg-accent"
					>
						<Paintbrush class="h-4 w-4" />
						{m['seatGridEditor.paint.applyToSelected']()}
					</button>
				{/if}
				<button
					type="button"
					onclick={onDelete}
					class="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
				>
					{m['seatGridEditor.deleteSelected']()}
				</button>
				<button
					type="button"
					onclick={onClear}
					class="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent"
				>
					{m['seatGridEditor.clearSelection']()}
				</button>
			</div>
		{/if}
	</div>

	{#if adjust.active}
		<p class="text-xs text-muted-foreground">{m['seatGridEditor.adjust.hintOn']()}</p>
		{#if adjust.selected === null}
			<p class="text-xs text-muted-foreground">{m['seatGridEditor.adjust.noSelection']()}</p>
		{/if}
		{#if adjust.addArmed}
			<p class="text-xs text-muted-foreground" role="status">
				{m['seatGridEditor.adjust.addSeatHint']()}
			</p>
		{/if}
	{/if}
</div>
