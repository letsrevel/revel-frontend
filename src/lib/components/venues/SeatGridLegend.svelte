<script lang="ts">
	/**
	 * The sector grid's legend and seat tally. Pure presentation, lifted out of
	 * SeatGridEditor to keep that file inside its cap.
	 */
	import * as m from '$lib/paraglide/messages.js';
	import { Accessibility, EyeOff } from '@lucide/svelte';
	import type { PriceCategorySchema } from '$lib/api/generated/types.gen';

	interface Props {
		priceCategories: PriceCategorySchema[];
		totalSeats: number;
	}

	const { priceCategories, totalSeats }: Props = $props();
</script>

<div class="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card p-4">
	<div class="flex flex-wrap items-center gap-4 text-sm md:gap-6">
		<div class="flex items-center gap-2">
			<div class="h-6 w-6 rounded bg-success"></div>
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
			<div class="h-6 w-6 rounded bg-highlight/25"></div>
			<span>{m['seatGridEditor.legendAisle']()}</span>
		</div>
		<div class="flex items-center gap-2">
			<Accessibility class="h-4 w-4 text-info" />
			<span>{m['seatGridEditor.legendAccessible']()}</span>
		</div>
		<div class="flex items-center gap-2">
			<EyeOff class="h-4 w-4 text-highlight-foreground dark:text-highlight" />
			<span>{m['seatGridEditor.legendObstructed']()}</span>
		</div>
		{#if priceCategories.length > 0}
			<div class="flex items-center gap-2">
				<div class="flex overflow-hidden rounded" aria-hidden="true">
					{#each priceCategories.slice(0, 3) as category (category.id)}
						<div class="h-6 w-2" style="background-color: {category.color};"></div>
					{/each}
				</div>
				<span>
					{m['seatGridEditor.legendPainted']()}
				</span>
			</div>
		{/if}
	</div>

	<div class="text-sm text-muted-foreground">
		{m['seatGridEditor.totalLabel']()}
		<strong data-testid="seat-grid-total">{totalSeats}</strong>
		{m['seatGridEditor.totalSeatsSuffix']({ count: totalSeats })}
	</div>
</div>
