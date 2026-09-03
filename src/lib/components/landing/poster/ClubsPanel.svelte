<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import PosterPanel from './PosterPanel.svelte';
	import PosterSticker from './PosterSticker.svelte';
	import MembershipCardMock from './MembershipCardMock.svelte';
</script>

<!-- All copy here is FULL-opacity ink on lavender: 5.68:1 (audit-brand-themes.py,
	 "poster clubs panel body"). The pills are ink on ink@12% over lavender: 4.68:1
	 ("clubs panel pill") — over the floor but with little headroom, so the pill
	 text must stay solid ink and the wash must not get darker. Lavender is
	 the brand secondary and the one poster solid no other panel uses; white text
	 on it fails AA (~2.6:1), so nothing on this panel is white except the sticker
	 face and the card mock. Hierarchy comes from weight, size and tracking, never
	 from an alpha on the ink. The pills tint only the BACKGROUND (ink@12% over
	 lavender) so the solid-ink pill text keeps its full ratio. -->
<!-- Panel order: clubs follows the crimson venues panel and precedes the
	 periwinkle communities panel, so the bottom cut reveals periwinkle. -->
<PosterPanel
	bgClass="bg-[hsl(var(--poster-lavender))]"
	cutToClass="cut-periwinkle"
	cutDirection="left"
>
	<div class="flex flex-wrap items-center gap-9">
		<!-- basis-full below sm pushes the mock onto its own row; min-w-0 keeps the
		     column from forcing a 300px track inside a 288px container at 320px
		     (same two-part fix as VenuesPanel / CommunitiesPanel). -->
		<div
			class="min-w-0 flex-1 basis-full text-[hsl(var(--poster-ink))] sm:min-w-[300px] sm:basis-0"
		>
			<p class="text-sm font-extrabold uppercase tracking-[0.12em]">
				{m['home.poster.clubsLabel']()}
			</p>
			<h2 class="mt-2.5 text-3xl font-black leading-[1.12] sm:text-4xl">
				{m['home.poster.clubsH1']()}<br />
				<PosterSticker tint="purple" rotate={-1.5} class="text-[0.9em]"
					>{m['home.poster.clubsSticker']()}</PosterSticker
				>
			</h2>
			<p class="mt-4 max-w-md text-lg font-semibold leading-relaxed">
				{m['home.poster.clubsBody']()}
			</p>
			<ul class="mt-4 flex flex-wrap gap-2 text-sm font-bold">
				<li class="rounded-full bg-[hsl(var(--poster-ink)/0.12)] px-3.5 py-1.5">
					{m['home.poster.clubsPill1']()}
				</li>
				<li class="rounded-full bg-[hsl(var(--poster-ink)/0.12)] px-3.5 py-1.5">
					{m['home.poster.clubsPill2']()}
				</li>
				<li class="rounded-full bg-[hsl(var(--poster-ink)/0.12)] px-3.5 py-1.5">
					{m['home.poster.clubsPill3']()}
				</li>
			</ul>
		</div>
		<MembershipCardMock />
	</div>
</PosterPanel>
