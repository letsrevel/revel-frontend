<script lang="ts">
	/**
	 * Segmented "This section / Whole venue" control for the buyer seat map.
	 *
	 * Mirrors SeatViewToggle (aria-pressed buttons, not a tablist) and, like
	 * it, renders OUTSIDE the map surface so it always stays tappable. Only
	 * offered when the chart actually has more than one sector.
	 */
	import * as m from '$lib/paraglide/messages.js';
	import { Armchair, Building2 } from '@lucide/svelte';
	import type { SeatMapScope } from './seat-view-toggle';

	interface Props {
		scope: SeatMapScope;
		onScopeChange: (scope: SeatMapScope) => void;
	}

	const { scope, onScopeChange }: Props = $props();

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
	aria-label={m['seatMap.scopeToggleLabel']()}
	class="inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted/50 p-0.5"
>
	<button
		type="button"
		aria-pressed={scope === 'section'}
		class={buttonClass(scope === 'section')}
		onclick={() => onScopeChange('section')}
	>
		<Armchair class="h-3.5 w-3.5" aria-hidden="true" />
		{m['seatMap.scopeSection']()}
	</button>
	<button
		type="button"
		aria-pressed={scope === 'venue'}
		class={buttonClass(scope === 'venue')}
		onclick={() => onScopeChange('venue')}
	>
		<Building2 class="h-3.5 w-3.5" aria-hidden="true" />
		{m['seatMap.scopeVenue']()}
	</button>
</div>
