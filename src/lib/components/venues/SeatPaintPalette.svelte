<script lang="ts">
	/**
	 * The venue price-category paint palette: chips that arm a paint color (or
	 * the eraser) for the grid. Lifted out of SeatGridEditor unchanged — the
	 * editor owns which chip is active, this only renders and reports clicks.
	 */
	import * as m from '$lib/paraglide/messages.js';
	import { Paintbrush, Eraser, Tag, TriangleAlert } from '@lucide/svelte';
	import type { PriceCategorySchema } from '$lib/api/generated/types.gen';

	interface Props {
		priceCategories: PriceCategorySchema[];
		/** Active chip: `null` = paint off; `categoryId: null` = eraser. */
		activePaint: { categoryId: string | null } | null;
		/** Deep link to where categories are actually managed (venue page). */
		manageCategoriesHref: string;
		onToggle: (categoryId: string | null) => void;
	}

	const { priceCategories, activePaint, manageCategoriesHref, onToggle }: Props = $props();

	const eraserActive = $derived(activePaint !== null && activePaint.categoryId === null);
</script>

<div class="rounded-lg border bg-card p-4">
	<div class="mb-1 flex items-center gap-2">
		<Paintbrush class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
		<h3 class="font-semibold">{m['seatGridEditor.paint.title']()}</h3>
	</div>

	<!-- What painting achieves — otherwise the palette reads as purely cosmetic. -->
	<p class="mb-1 text-xs text-muted-foreground">
		{m['seatGridEditor.paint.explainer']()}
	</p>
	<!-- Blast radius BEFORE the paint commits (#674): the editor is opened in
	     the context of one event, which is exactly what makes the venue-wide,
	     immediate effect of repainting surprising. -->
	<p class="mb-3 flex items-start gap-1.5 text-xs text-highlight-foreground dark:text-highlight">
		<TriangleAlert class="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
		{m['seatGridEditor.paint.venueWideCaution']()}
	</p>

	{#if priceCategories.length === 0}
		<p class="text-sm text-muted-foreground">
			{m['seatGridEditor.paint.noCategories']()}
		</p>
		<!-- eslint-disable svelte/no-navigation-without-resolve -- href is the manageCategoriesHref prop, resolve()d by the caller, plus a hash fragment -->
		<a
			href={manageCategoriesHref}
			class="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
		>
			<Tag class="h-4 w-4" aria-hidden="true" />
			{m['seatGridEditor.paint.manageCategories']()}
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	{:else}
		<div
			class="flex flex-wrap items-center gap-2"
			role="group"
			aria-label={m['seatGridEditor.paint.paletteLabel']()}
		>
			{#each priceCategories as category (category.id)}
				{@const categoryId = category.id}
				{#if categoryId}
					{@const isActive = activePaint?.categoryId === categoryId}
					<button
						type="button"
						onclick={() => onToggle(categoryId)}
						aria-pressed={isActive}
						class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors {isActive
							? 'border-primary bg-primary/10 ring-2 ring-primary ring-offset-1'
							: 'border-input hover:bg-accent'}"
					>
						<span
							class="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-inset ring-border"
							style="background-color: {category.color};"
							aria-hidden="true"
						></span>
						{category.name}
					</button>
				{/if}
			{/each}
			<button
				type="button"
				onclick={() => onToggle(null)}
				aria-pressed={eraserActive}
				class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors {eraserActive
					? 'border-primary bg-primary/10 ring-2 ring-primary ring-offset-1'
					: 'border-input hover:bg-accent'}"
			>
				<Eraser class="h-3.5 w-3.5" aria-hidden="true" />
				{m['seatGridEditor.paint.unpainted']()}
			</button>
		</div>

		{#if activePaint}
			<p class="mt-2 text-xs text-muted-foreground" role="status">
				{m['seatGridEditor.paint.activeHint']()}
			</p>
		{/if}
	{/if}
</div>
