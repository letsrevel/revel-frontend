<script lang="ts">
	/**
	 * Segmented Map/List control for the buyer seat pickers (#659).
	 *
	 * Deliberately rendered OUTSIDE the SeatMap surface (which sets
	 * touch-action: none), so it stays a normal scrollable/tappable region on
	 * mobile. Two toggle buttons with aria-pressed — not a tablist — because
	 * the views are alternative renderings of the same state, not panels.
	 */
	import * as m from '$lib/paraglide/messages.js';
	import { List, Map as MapIcon } from '@lucide/svelte';
	import type { SeatViewMode } from './seat-view-toggle';

	interface Props {
		mode: SeatViewMode;
		onModeChange: (mode: SeatViewMode) => void;
	}

	const { mode, onModeChange }: Props = $props();

	const buttonBase =
		'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ' +
		'focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ' +
		'[@media(pointer:coarse)]:py-2.5';

	function buttonClass(active: boolean): string {
		return active
			? `${buttonBase} bg-background text-foreground shadow-sm`
			: `${buttonBase} text-muted-foreground hover:text-foreground`;
	}
</script>

<div
	role="group"
	aria-label={m['seatMap.viewToggleLabel']()}
	class="inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted/50 p-0.5"
>
	<button
		type="button"
		aria-pressed={mode === 'map'}
		class={buttonClass(mode === 'map')}
		onclick={() => onModeChange('map')}
	>
		<MapIcon class="h-3.5 w-3.5" aria-hidden="true" />
		{m['seatMap.viewMap']()}
	</button>
	<button
		type="button"
		aria-pressed={mode === 'list'}
		class={buttonClass(mode === 'list')}
		onclick={() => onModeChange('list')}
	>
		<List class="h-3.5 w-3.5" aria-hidden="true" />
		{m['seatMap.viewList']()}
	</button>
</div>
