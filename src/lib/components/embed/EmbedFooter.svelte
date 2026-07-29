<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		/** Attributed link back to Revel. */
		poweredByHref: string;
		/** Optional "see everything" link (the org or series page on Revel). */
		moreHref?: string | null;
		/** Label for {@link moreHref}. */
		moreLabel?: string;
	}

	const { poweredByHref, moreHref = null, moreLabel }: Props = $props();

	const linkClasses =
		'rounded-sm underline-offset-4 hover:underline focus-visible:outline-none ' +
		'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';
</script>

<footer
	class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border px-4 py-3 text-xs"
>
	{#if moreHref}
		<a
			href={moreHref}
			target="_blank"
			rel="noopener"
			class="font-medium text-primary {linkClasses}"
		>
			{moreLabel ?? m['embed.seeAllEvents']()}
			<span class="sr-only">({m['embed.openInNewTab']()})</span>
		</a>
	{:else}
		<span></span>
	{/if}

	<a
		href={poweredByHref}
		target="_blank"
		rel="noopener"
		class="text-muted-foreground hover:text-foreground {linkClasses}"
	>
		{m['embed.poweredBy']()}
		<span class="sr-only">({m['embed.openInNewTab']()})</span>
	</a>
</footer>
