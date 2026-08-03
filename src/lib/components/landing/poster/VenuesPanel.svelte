<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import PosterPanel from './PosterPanel.svelte';
	import PosterSticker from './PosterSticker.svelte';
	import SeatMapMock from './SeatMapMock.svelte';
</script>

<!-- White on crimson-deep measures 4.58:1 — over the 4.5 AA floor, but with almost
	 no headroom. So NOTHING on this panel may soften white with an alpha: white@75%
	 composites to 3.08:1, an AA failure at every size. Every white string here is
	 full-opacity, and hierarchy comes from weight, size and tracking instead. -->
<PosterPanel
	bgClass="bg-[hsl(var(--poster-crimson-deep))]"
	cutToClass="cut-paper"
	cutDirection="left"
>
	<div class="flex flex-wrap-reverse items-center gap-9">
		<SeatMapMock />
		<div class="min-w-0 flex-1 text-[hsl(var(--poster-white))] sm:min-w-[300px]">
			<!-- Deliberately NOT `opacity-75` (see panel note): 4.58:1 → 3.08:1. -->
			<p class="text-sm font-extrabold uppercase tracking-[0.12em]">
				{m['home.poster.venuesLabel']()}
			</p>
			<h2 class="mt-2.5 text-3xl font-black leading-[1.12] sm:text-4xl">
				{m['home.poster.venuesH1']()}<br />
				<PosterSticker tint="crimson" rotate={-1.5} class="text-[0.9em]"
					>{m['home.poster.venuesSticker']()}</PosterSticker
				>
			</h2>
			<p class="mt-4 max-w-md text-lg font-semibold leading-relaxed">
				{m['home.poster.venuesBody']()}
			</p>
			<!-- white@95 over crimson-deep is essentially white, so solid ink on the
				 pills is ~16.2:1 — hand-verified (composited alpha). The pill text must
				 stay solid ink; softening it would eat that margin for nothing. -->
			<ul class="mt-4 flex flex-wrap gap-2 text-sm font-bold text-[hsl(var(--poster-ink))]">
				<li class="rounded-full bg-[hsl(var(--poster-white)/0.95)] px-3.5 py-1.5">
					{m['home.poster.venuesPill1']()}
				</li>
				<li class="rounded-full bg-[hsl(var(--poster-white)/0.95)] px-3.5 py-1.5">
					{m['home.poster.venuesPill2']()}
				</li>
				<li class="rounded-full bg-[hsl(var(--poster-white)/0.95)] px-3.5 py-1.5">
					{m['home.poster.venuesPill3']()}
				</li>
			</ul>
		</div>
	</div>
</PosterPanel>
