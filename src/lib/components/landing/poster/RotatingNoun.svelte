<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		items: string[];
		intervalMs?: number;
	}
	const { items, intervalMs = 2500 }: Props = $props();

	// SSR renders index 0; rotation is client-only, so hydration never
	// changes the markup (same lesson as #505 in the old LandingHero).
	let active = $state(0);

	onMount(() => {
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
		const iv = setInterval(() => {
			active = (active + 1) % items.length;
		}, intervalMs);
		return () => clearInterval(iv);
	});
</script>

<!-- inline-grid stacks all items in one cell: the box is as wide as the
     longest item, so swapping never reflows the headline. -->
<span class="rotating-noun inline-grid text-center align-baseline" aria-hidden="true">
	<!-- Keyed by index, not by the string: the list is static and
	     index-stable, and keying by the item would throw each_key_duplicate
	     on a locale whose list repeats a word (e.g. endings ['a','a']). -->
	{#each items as item, i (i)}
		<span
			class="col-start-1 row-start-1 transition-[opacity,transform] duration-500 {i === active
				? 'is-active opacity-100 [transform:rotateX(0)]'
				: 'opacity-0 [transform:rotateX(90deg)]'}"
		>
			{item}
		</span>
	{/each}
</span>

<style>
	/* This component flips its items on rotateX. The embedding panel sets
	   `perspective` on an ancestor, but `perspective` only reaches that
	   element's DIRECT children — and this wrapper sits in between with the
	   default `transform-style: flat`, which flattens its own children back
	   out. Without this the flip renders as a plain vertical squash. Scoped
	   here rather than global in app.css because `.rotating-noun` is a literal
	   in this file's markup (so Svelte scoping and Tailwind purging both see
	   it), and every embedding panel gets it by virtue of using the component. */
	.rotating-noun {
		transform-style: preserve-3d;
	}
</style>
