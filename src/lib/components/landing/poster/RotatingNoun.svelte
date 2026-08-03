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
	{#each items as item, i (item)}
		<span
			class="col-start-1 row-start-1 transition-[opacity,transform] duration-500 {i === active
				? 'is-active opacity-100 [transform:rotateX(0)]'
				: 'opacity-0 [transform:rotateX(90deg)]'}"
		>
			{item}
		</span>
	{/each}
</span>
