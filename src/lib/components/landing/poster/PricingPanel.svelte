<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Calculator } from '@lucide/svelte';
	import PosterPanel from './PosterPanel.svelte';
	import PosterSticker from './PosterSticker.svelte';

	interface Props {
		onOpenCalculator: () => void;
	}
	const { onOpenCalculator }: Props = $props();
</script>

<!-- Every text layer here is full-opacity ink on amber (~10:1). Dimming the small
	 type with `opacity-65`/`opacity-75` drops it under AA at these sizes, and a
	 composited alpha is invisible to scripts/audit-brand-themes.py — so the
	 hierarchy is carried by weight, size and tracking, never by transparency. -->
<PosterPanel
	bgClass="bg-[hsl(var(--poster-amber))]"
	cutToClass="cut-periwinkle"
	cutDirection="left"
>
	<div class="flex flex-wrap items-end gap-10 text-[hsl(var(--poster-ink))]">
		<div>
			<p class="text-sm font-extrabold uppercase tracking-[0.12em]">
				{m['home.poster.pricingLabel']()}
			</p>
			<p class="text-8xl font-black leading-[0.95] sm:text-9xl">€0</p>
			<p class="text-xl font-bold">{m['home.poster.pricingForFree']()}</p>
		</div>
		<div class="max-w-md pb-2">
			<p class="mb-3 text-lg">
				<PosterSticker tint="crimson" rotate={-2}>{m['home.poster.pricingSticker']()}</PosterSticker
				>
			</p>
			<p class="leading-relaxed">{m['home.poster.pricingBody']()}</p>
			<p class="mt-3 text-sm">{m['home.poster.pricingCompare']()}</p>
			<button
				type="button"
				onclick={onOpenCalculator}
				class="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--poster-ink))] px-4 py-2 text-sm font-bold text-[hsl(var(--poster-white))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--poster-ink))]"
			>
				<Calculator class="h-4 w-4" aria-hidden="true" />
				{m['learnMore.feeCalculator.calculateYourFees']()}
			</button>
			<p class="mt-3 text-xs">
				<a
					href="mailto:contact@letsrevel.io?subject=Revel%20Fee%20Negotiation"
					class="underline underline-offset-2"
				>
					{m['learnMore.pricingHappyToNegotiate']()}
				</a>
				<span class="mx-1" aria-hidden="true">·</span>
				{m['learnMore.feesExcludeVat']()}
			</p>
		</div>
	</div>
</PosterPanel>
