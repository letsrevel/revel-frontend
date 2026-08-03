<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import PosterPanel from './PosterPanel.svelte';

	interface Props {
		/** Feature flag: false swaps the primary CTA for "Browse events". */
		canCreateOrg: boolean;
	}
	const { canCreateOrg }: Props = $props();
</script>

<!-- Last panel, so no cut. crimson-deep (not raw crimson) per the panel rule:
     the deep variant is the AA-safe surface for white text.
     The gradient's visible range is purple → 63.6% of the way to crimson-deep
     (the 140% stop falls outside the box), i.e. #8C3CDD → #C42D61. White text
     measures 5.52:1 at the purple end and 5.38:1 at the far end — AA at any
     size across the whole panel. -->
<PosterPanel
	bgClass="bg-[linear-gradient(200deg,hsl(var(--poster-purple))_30%,hsl(var(--poster-crimson-deep))_140%)]"
>
	<div class="text-center text-[hsl(var(--poster-white))]">
		<!-- The "let's revel." lockup, set in the brand face (Nata Sans) at poster
		     scale. Deliberately NOT RevelWordmark: that component is the fixed
		     text-2xl header lockup (h-7 mark, light/semibold, `text-accent` full),
		     none of which survives at font-black 48px on a poster panel.
		     The amber period measures 2.98:1 on the purple end / 2.90:1 at the far
		     end — under the 3:1 large-text floor, kept under WCAG 1.4.3's logotype
		     exception (it is the brand lockup's accent, mirroring RevelWordmark's
		     accent period) and because the glyph carries no information: the
		     heading reads identically without it. -->
		<h2 class="text-4xl font-black sm:text-5xl">
			let&rsquo;s revel<span class="text-[hsl(var(--poster-amber))]">.</span>
		</h2>
		<!-- Full-opacity white. At text-lg/medium (18px — non-large, so the full
		     4.5:1 applies) a 0.9 alpha measures 4.78:1 on the purple end and
		     4.62:1 at the far end: passing, but on a margin thin enough that
		     antialiasing on this gradient eats it. Full opacity is 5.52 / 5.38. -->
		<p class="mt-2.5 text-lg font-medium text-[hsl(var(--poster-white))]">
			{m['home.poster.closeTagline']()}
		</p>
		<div class="mt-6 flex flex-wrap justify-center gap-3.5">
			<!-- Ink pill, white text: 17.46:1. -->
			{#if canCreateOrg}
				<a
					href={resolve('/(auth)/create-org', {})}
					class="rounded-full bg-[hsl(var(--poster-ink))] px-8 py-3.5 font-bold text-[hsl(var(--poster-white))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
				>
					{m['home.poster.closeCreateOrg']()}
				</a>
			{:else}
				<a
					href={resolve('/(public)/events', {})}
					class="rounded-full bg-[hsl(var(--poster-ink))] px-8 py-3.5 font-bold text-[hsl(var(--poster-white))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
				>
					{m['nav.browseEvents']()}
				</a>
			{/if}
			<!-- No fill needed here, unlike the hero's ghost CTAs: those sat on a
			     white/0.16 wash that dragged white text to 4.14:1. Unwashed, this
			     gradient never drops below 5.38:1 for white. -->
			<a
				href="https://demo.letsrevel.io/login"
				target="_blank"
				rel="noopener noreferrer"
				class="rounded-full border-2 border-[hsl(var(--poster-white))] px-7 py-3 font-bold text-[hsl(var(--poster-white))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
			>
				{m['home.poster.closeTryDemo']()}
			</a>
		</div>
	</div>
</PosterPanel>
