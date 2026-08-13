<script lang="ts">
	/**
	 * Bulk actions for the current grid selection (accessible/obstructed flags,
	 * paint, delete, clear). Markup lifted verbatim out of SeatGridEditor to keep
	 * that file inside its length cap; it stays a dumb view — every mutation, and
	 * its undo point, belongs to the editor.
	 */
	import * as m from '$lib/paraglide/messages.js';
	import { Accessibility, EyeOff, Paintbrush } from '@lucide/svelte';

	interface Props {
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
		count,
		canPaint,
		onToggleAccessible,
		onToggleObstructed,
		onPaint,
		onDelete,
		onClear
	}: Props = $props();
</script>

{#if count > 0}
	<div class="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
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
	</div>
{/if}
