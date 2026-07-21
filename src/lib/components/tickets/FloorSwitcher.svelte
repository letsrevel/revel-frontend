<script lang="ts">
	/**
	 * Segmented floor chips for multi-floor venues (#680): one aria-pressed
	 * button per floor, rendering ONE floor of the whole-venue map at a time.
	 * Mirrors SeatScopeToggle/SeatViewToggle (button group, not a tablist) and
	 * like them renders OUTSIDE the map surface so it always stays tappable.
	 * Only offered when the chart declares more than one floor. Switching
	 * floors is pure presentation — it never touches seat holds.
	 *
	 * The sr-only live region announces the swap politely: the map content
	 * changes wholesale under AT while focus stays on the pressed chip.
	 */
	import * as m from '$lib/paraglide/messages.js';
	import type { VenueFloor } from '$lib/components/venues/venue-floors';

	interface Props {
		floors: readonly VenueFloor[];
		activeFloorId: string | null;
		onFloorChange: (floorId: string) => void;
	}

	const { floors, activeFloorId, onFloorChange }: Props = $props();

	let announcement = $state('');

	const buttonBase =
		'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ' +
		'focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ' +
		'[@media(pointer:coarse)]:py-2.5';

	function buttonClass(active: boolean): string {
		return active
			? `${buttonBase} bg-background text-foreground shadow-sm`
			: `${buttonBase} text-muted-foreground hover:text-foreground`;
	}

	function handleClick(floor: VenueFloor): void {
		announcement = m['seatMap.floorShown']({ name: floor.name });
		onFloorChange(floor.id);
	}
</script>

<div
	role="group"
	aria-label={m['seatMap.floorSwitcherLabel']()}
	class="inline-flex flex-wrap items-center gap-0.5 rounded-lg border border-border bg-muted/50 p-0.5"
>
	{#each floors as floor (floor.id)}
		<button
			type="button"
			aria-pressed={floor.id === activeFloorId}
			class={buttonClass(floor.id === activeFloorId)}
			onclick={() => handleClick(floor)}
		>
			{floor.name}
		</button>
	{/each}
</div>
<span class="sr-only" aria-live="polite">{announcement}</span>
