<script lang="ts">
	import type { WithElementRef } from 'bits-ui';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div
	bind:this={ref}
	class={cn(
		// Poster silhouette (uplift prototype): the landing's cards are thick-
		// edged and genuinely floating, so the app's default card stops being a
		// hairline-and-shadow-sm rectangle. `rounded-lg` is already the 1.25rem
		// sticker radius; the 2px border + `shadow-poster` are the change.
		'rounded-lg border-2 bg-card text-card-foreground shadow-poster',
		className
	)}
	{...restProps}
>
	{@render children?.()}
</div>
