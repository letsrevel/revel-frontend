<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Info } from '@lucide/svelte';

	interface Props {
		/** Note body. Kept short — these are scanned, not read. */
		children: Snippet;
	}

	const { children }: Props = $props();
</script>

<!--
	Tax scoping caveats are deliberately always visible rather than hidden behind a
	disclosure: an organizer who misses one can file the wrong taxable turnover.
	The info mark is decorative — the meaning is carried by the text and the box,
	never by colour alone.
-->
<p
	class="flex gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs leading-relaxed text-foreground"
>
	<Info class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
	<span>{@render children()}</span>
</p>
