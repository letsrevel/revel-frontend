<script lang="ts">
	import type { Snippet } from 'svelte';
	import SectionHeader from '$lib/components/common/SectionHeader.svelte';

	interface Props {
		/** Anchor id, e.g. `section-basics` (the section nav links to `#<id>`). */
		id: string;
		/** Already-translated heading and one-line explainer. */
		title: string;
		subtitle?: string;
		children: Snippet;
	}

	const { id, title, subtitle, children }: Props = $props();
</script>

<!-- scroll-mt clears the sticky site header when a nav link jumps here;
     tabindex=-1 + focus:outline-none lets the nav move focus into the section. -->
<section
	{id}
	aria-labelledby="{id}-heading"
	tabindex="-1"
	class="scroll-mt-[calc(var(--admin-sticky-top)+1rem)] space-y-3 focus:outline-none"
>
	<SectionHeader id="{id}-heading" level={2} {title} {subtitle} />
	<div class="space-y-6 rounded-lg border border-border bg-card p-4 md:p-6">
		{@render children()}
	</div>
</section>
