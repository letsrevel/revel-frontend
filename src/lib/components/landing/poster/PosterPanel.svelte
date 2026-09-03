<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** Tailwind background classes for the panel, e.g. "bg-[hsl(var(--poster-amber))]". */
		bgClass: string;
		/**
		 * The `.cut-*` helper class naming the NEXT panel's color — e.g. 'cut-amber'
		 * when the panel below this one is amber. Renders the diagonal cut strip.
		 * These helpers live in app.css and set `--cut-color`; this is NOT a
		 * `bg-[...]` class, and passing one would render no strip at all.
		 */
		cutToClass?:
			| 'cut-amber'
			| 'cut-periwinkle'
			| 'cut-crimson'
			| 'cut-paper'
			| 'cut-ink'
			| 'cut-purple'
			| 'cut-lavender';
		cutDirection?: 'right' | 'left';
		children: Snippet;
	}
	const { bgClass, cutToClass, cutDirection = 'right', children }: Props = $props();
	const angle = $derived(cutDirection === 'right' ? '176deg' : '-176deg');
</script>

<section class="relative overflow-hidden {bgClass}">
	<div class="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-8 sm:pb-24 sm:pt-14">
		{@render children()}
	</div>
	{#if cutToClass}
		<div
			class="diagonal-cut pointer-events-none absolute inset-x-0 bottom-[-1px] h-14 {cutToClass}"
			style="--cut-angle: {angle}"
			aria-hidden="true"
		></div>
	{/if}
</section>

<style>
	/* The `.cut-*` helper on this strip (see app.css) sets `--cut-color` to the
	   NEXT panel's color; the gradient reveals it under a transparent top
	   triangle, so the two panels meet on a diagonal. */
	.diagonal-cut {
		background: linear-gradient(var(--cut-angle), transparent 49%, var(--cut-color) 49.5%);
	}
</style>
