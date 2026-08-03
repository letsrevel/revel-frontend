<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import RevelMark from '$lib/components/brand/RevelMark.svelte';
	import Github from '$lib/components/icons/brand/Github.svelte';
	import PosterPanel from './PosterPanel.svelte';
	import PosterSticker from './PosterSticker.svelte';
</script>

<!-- Ink panel; the next panel (ClosePanel) opens on purple, hence cut-purple. -->
<PosterPanel bgClass="bg-[hsl(var(--poster-ink))]" cutToClass="cut-purple">
	<div class="flex flex-wrap items-center gap-8">
		<!-- basis-full below sm pushes the R mark onto its own row; min-w-0 keeps the
		     column from forcing a 300px track inside a 288px container at 320px. -->
		<div
			class="min-w-0 flex-1 basis-full text-[hsl(var(--poster-white))] sm:min-w-[300px] sm:basis-0"
		>
			<!-- opacity-50 is safe ONLY because the surface is near-black: white at
			     50% composites to #868E8D over ink, measured 5.19:1 — above the 4.5:1
			     AA floor for this 14px non-large text. Do not reuse this opacity on a
			     lighter panel. audit-brand-themes.py cannot see it (composited at
			     paint time, not a token pair). -->
			<p class="text-sm font-extrabold uppercase tracking-[0.12em] opacity-50">
				{m['home.poster.osLabel']()}
			</p>
			<h2 class="mt-2 text-3xl font-black leading-[1.15] sm:text-4xl">
				{m['home.poster.osH1a']()}<br />
				{m['home.poster.osH1b']()}
				<PosterSticker tint="purple" rotate={-2} class="text-[0.75em]"
					>{m['home.poster.osSticker']()}</PosterSticker
				>
			</h2>
			<!-- White at 80% over ink measures 11.43:1 — comfortably above AA. -->
			<p class="mt-3.5 max-w-md leading-relaxed text-[hsl(var(--poster-white)/0.8)]">
				{m['home.poster.osBody']()}
			</p>
			<!-- White pill, ink text: 17.46:1. -->
			<a
				href="https://github.com/letsrevel"
				target="_blank"
				rel="noopener noreferrer"
				class="mt-5 inline-flex items-center gap-2 rounded-full bg-[hsl(var(--poster-white))] px-5 py-3 text-sm font-bold text-[hsl(var(--poster-ink))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
			>
				<Github class="h-4 w-4" aria-hidden="true" />
				<!-- The star is decoration: hidden so the accessible name stays
				     "Star on GitHub" rather than "star Star on GitHub". -->
				<span><span aria-hidden="true">⭐</span> {m['home.poster.osCta']()}</span>
			</a>
		</div>
		<RevelMark
			decorative
			gradient={false}
			class="h-32 w-auto -rotate-6 text-[hsl(var(--poster-white)/0.9)]"
		/>
	</div>
</PosterPanel>
