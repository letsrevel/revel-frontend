<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** Already-translated sub-heading. */
		title?: string;
		/** Hairline above the group. Leave on for every group except a section's first. */
		divider?: boolean;
		children: Snippet;
	}

	const { title, divider = true, children }: Props = $props();
</script>

<div class={divider ? 'space-y-4 border-t border-border pt-6' : 'space-y-4'}>
	{#if title}
		<h3 class="text-sm font-semibold">{title}</h3>
	{/if}
	{@render children()}
</div>
