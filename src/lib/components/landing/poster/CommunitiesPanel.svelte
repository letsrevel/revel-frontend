<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import PosterPanel from './PosterPanel.svelte';
	import PosterSticker from './PosterSticker.svelte';
	import QuestionnaireMock from './QuestionnaireMock.svelte';
</script>

<!-- All copy here is FULL-opacity ink on periwinkle (~9:1). The small uppercase
	 label deliberately carries no `opacity-65`: ink at 65% composites to ~2.5:1,
	 an AA failure at text-sm. Hierarchy comes from weight, size and tracking.
	 The pills tint only the BACKGROUND (ink@12% over periwinkle, still light), so
	 the solid-ink pill text stays ~8:1. -->
<PosterPanel bgClass="bg-[hsl(var(--poster-periwinkle))]" cutToClass="cut-crimson">
	<div class="flex flex-wrap items-center gap-9">
		<!-- basis-full below sm pushes the mock onto its own row; min-w-0 keeps the
		     column from forcing a 300px track inside a 288px container at 320px.
		     Both are needed: min-w-0 alone lets the w-80 mock share the row in the
		     390-639px band and squeezes the text column to a couple of pixels. -->
		<div
			class="min-w-0 flex-1 basis-full text-[hsl(var(--poster-ink))] sm:min-w-[300px] sm:basis-0"
		>
			<p class="text-sm font-extrabold uppercase tracking-[0.12em]">
				{m['home.poster.communitiesLabel']()}
			</p>
			<h2 class="mt-2.5 text-3xl font-black leading-[1.12] sm:text-4xl">
				<PosterSticker tint="ink" rotate={-1.5} class="text-[0.9em]"
					>{m['home.poster.communitiesStickerWord']()}</PosterSticker
				>
				{m['home.poster.communitiesH1b']()}<br />
				{m['home.poster.communitiesH1c']()}
			</h2>
			<p class="mt-4 max-w-md leading-relaxed">{m['home.poster.communitiesBody']()}</p>
			<ul class="mt-4 flex flex-wrap gap-2 text-sm font-bold">
				<li class="rounded-full bg-[hsl(var(--poster-ink)/0.12)] px-3.5 py-1.5">
					{m['home.poster.communitiesPill1']()}
				</li>
				<li class="rounded-full bg-[hsl(var(--poster-ink)/0.12)] px-3.5 py-1.5">
					{m['home.poster.communitiesPill2']()}
				</li>
				<li class="rounded-full bg-[hsl(var(--poster-ink)/0.12)] px-3.5 py-1.5">
					{m['home.poster.communitiesPill3']()}
				</li>
			</ul>
		</div>
		<QuestionnaireMock />
	</div>
</PosterPanel>
