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

	/**
	 * Every swatch is a MINIATURE OF THE CANVAS: the seat state as it is really
	 * drawn, on its own little poster-ink pad — the legend card itself stays a
	 * theme surface, so the poster values never have to survive a light card.
	 * The swatches are decorative duplicates of the label beside them (SC 1.4.1
	 * is met by the text; 1.4.11 does not bite on graphics carrying no unique
	 * information), which is what lets the aisle and empty-slot chips be as
	 * faint on the pad as they are on the canvas.
	 */
	const padClass = 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-poster-ink';
</script>

<div class="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card p-4">
	<div class="flex flex-wrap items-center gap-4 text-sm md:gap-6">
		<div class="flex items-center gap-2">
			<div class={padClass} aria-hidden="true">
				<div class="h-4 w-4 rounded-full bg-poster-periwinkle"></div>
			</div>
			<span>{m['seatGridEditor.legendSeat']()}</span>
		</div>
		<div class="flex items-center gap-2">
			<div class={padClass} aria-hidden="true">
				<div class="h-4 w-4 rounded-full border border-poster-white/40"></div>
			</div>
			<span>{m['seatGridEditor.legendEmpty']()}</span>
		</div>
		<div class="flex items-center gap-2">
			<div class={padClass} aria-hidden="true">
				<div
					class="h-3 w-3 rounded-full bg-poster-periwinkle outline outline-2 outline-offset-2 outline-poster-white"
				></div>
			</div>
			<span>{m['seatGridEditor.legendSelected']()}</span>
		</div>
		<div class="flex items-center gap-2">
			<!-- The aisle band is faint BY DESIGN on the canvas (white@8, a gap in the
			     seating, not a thing). At 7px the same wash would be invisible, so
			     the chip outlines it — the outline is legend-only. -->
			<div class={padClass} aria-hidden="true">
				<div
					class="h-5 w-3 rounded-sm bg-poster-white/[0.08] outline-dashed outline-1 outline-poster-white/40"
				></div>
			</div>
			<span>{m['seatGridEditor.legendAisle']()}</span>
		</div>
		<div class="flex items-center gap-2">
			<div class={padClass} aria-hidden="true">
				<Accessibility class="h-4 w-4 text-poster-periwinkle" />
			</div>
			<span>{m['seatGridEditor.legendAccessible']()}</span>
		</div>
		<div class="flex items-center gap-2">
			<div class={padClass} aria-hidden="true">
				<EyeOff class="h-4 w-4 text-poster-amber" />
			</div>
			<span>{m['seatGridEditor.legendObstructed']()}</span>
		</div>
		{#if priceCategories.length > 0}
			<div class="flex items-center gap-2">
				<div class="{padClass} gap-0.5" aria-hidden="true">
					{#each priceCategories.slice(0, 3) as category (category.id)}
						<div class="h-3 w-1.5 rounded-full" style="background-color: {category.color};"></div>
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
