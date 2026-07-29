<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { getImageUrl } from '$lib/utils/url';

	interface Props {
		/** Display name of the organization or series. */
		title: string;
		/** Optional subtitle (organization name under a series title, …). */
		subtitle?: string | null;
		/** Logo/avatar path as returned by the backend. */
		logo?: string | null;
		/** Attributed, absolute link to the corresponding page on Revel. */
		href: string;
		/** Heading level — an embed is a fragment of someone else's document. */
		headingId?: string;
	}

	const { title, subtitle = null, logo = null, href, headingId }: Props = $props();

	const logoUrl = $derived(getImageUrl(logo));
</script>

<header class="flex items-center gap-3 border-b border-border px-4 py-3">
	{#if logoUrl}
		<img
			src={logoUrl}
			alt=""
			width="40"
			height="40"
			loading="lazy"
			class="h-10 w-10 shrink-0 rounded-full object-cover"
		/>
	{/if}

	<div class="min-w-0 flex-1">
		<h2 id={headingId} class="truncate text-sm font-semibold leading-tight">
			<a
				{href}
				target="_blank"
				rel="noopener"
				class="rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			>
				{title}
				<span class="sr-only">({m['embed.openInNewTab']()})</span>
			</a>
		</h2>
		{#if subtitle}
			<p class="truncate text-xs text-muted-foreground">{subtitle}</p>
		{/if}
	</div>
</header>
