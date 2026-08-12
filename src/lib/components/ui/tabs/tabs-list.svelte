<script lang="ts">
	import { Tabs as TabsPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';

	let { ref = $bindable(null), class: className, ...restProps }: TabsPrimitive.ListProps = $props();
</script>

<TabsPrimitive.List
	bind:ref
	class={cn(
		// `safe center` rather than `justify-center`, plus max-w-full + scroll:
		// a centered flex line that outgrows its box overflows BOTH edges, and
		// neither end can be scrolled to — the members admin strip lost its first
		// and last tab that way. `safe` falls back to flex-start exactly when the
		// content overflows, so nothing is ever stranded. (No call site passes a
		// `justify-*` of its own; one that did would have to use the arbitrary
		// form too, since tailwind-merge treats these as separate groups.)
		'inline-flex h-10 max-w-full items-center overflow-x-auto rounded-md bg-muted p-1 text-muted-foreground [justify-content:safe_center]',
		className
	)}
	{...restProps}
/>
