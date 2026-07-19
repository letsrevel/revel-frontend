<script lang="ts">
	/**
	 * Passive price-category legend for the seat-map designer. Pure presentation:
	 * lists the venue's price categories with their color swatch + name so the
	 * canvas's category-colored seats are decodable (color is never the only
	 * signal). Painting itself lives in the grid editor, not here.
	 */
	import * as m from '$lib/paraglide/messages.js';
	import type { PriceCategorySchema } from '$lib/api/generated/types.gen';

	interface Props {
		categories: PriceCategorySchema[];
	}

	const { categories }: Props = $props();
</script>

{#if categories.length > 0}
	<div class="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
		<span class="font-medium">
			{m['seatDesigner.categoriesLegend']()}
		</span>
		{#each categories as category (category.id ?? category.name)}
			<span class="inline-flex items-center gap-1.5">
				<span
					class="inline-block h-3 w-3 rounded-full border border-border"
					style="background: {category.color}"
					aria-hidden="true"
				></span>
				{category.name}
			</span>
		{/each}
	</div>
{/if}
