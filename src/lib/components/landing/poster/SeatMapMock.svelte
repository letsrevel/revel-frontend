<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import PosterSticker from './PosterSticker.svelte';

	// [row lengths, zone] pairs drawn as dot rows. Index 3 of row 0 is the
	// "selected" seat (white ring), purely decorative.
	const rows: Array<{ n: number; zone: 'parterre' | 'balcony' }> = [
		{ n: 6, zone: 'parterre' },
		{ n: 7, zone: 'parterre' },
		{ n: 8, zone: 'balcony' },
		{ n: 8, zone: 'balcony' }
	];
	// Deterministic "taken" seats per row (no Math.random: SSR-stable).
	const taken = new Set(['2-2', '2-5', '3-1', '3-6']);
</script>

<!-- Decorative: the whole card is one `role="img"` with a single accessible name,
	 so every inner layer is aria-hidden and screen readers never walk the mock.
	 The seat dots encode zone by colour ONLY inside that decorative image; the
	 legend below re-states every zone in words, so no meaning is colour-only. -->
<div
	role="img"
	aria-label={m['home.poster.seatMockAria']()}
	class="w-[360px] max-w-full -rotate-2 rounded-[20px] bg-[hsl(var(--poster-ink))] p-5 shadow-[0_10px_30px_hsl(var(--poster-ink)/0.35)]"
>
	<div class="pointer-events-none relative" aria-hidden="true">
		<div class="absolute -top-8 left-0">
			<PosterSticker tint="crimson" rotate={-3} class="text-sm"
				>{m['home.poster.seatMockSticker']()}</PosterSticker
			>
		</div>
	</div>
	<div aria-hidden="true">
		<!-- white@14 over ink composites to a near-ink strip, so FULL-opacity white
			 on it is ~11.5:1 — hand-verified, composited alphas are invisible to
			 scripts/audit-brand-themes.py. -->
		<p
			class="mt-3 rounded-b-md rounded-t-full bg-[hsl(var(--poster-white)/0.14)] py-1 text-center text-[10px] font-extrabold uppercase tracking-[0.2em] text-[hsl(var(--poster-white))]"
		>
			{m['home.poster.seatMockStage']()}
		</p>
		<div class="mt-4 flex flex-col items-center gap-2">
			{#each rows as row, r (r)}
				<div class="flex gap-1.5 {r === 2 ? 'mt-1.5' : ''}">
					{#each Array(row.n) as _, s (s)}
						<span
							class="h-3 w-3 rounded-full
								{taken.has(`${r}-${s}`)
								? 'bg-[hsl(var(--poster-white)/0.25)]'
								: row.zone === 'parterre'
									? 'bg-[hsl(var(--poster-amber))]'
									: 'bg-[hsl(var(--poster-periwinkle))]'}
								{r === 0 && s === 3 ? 'outline outline-2 outline-offset-2 outline-[hsl(var(--poster-white))]' : ''}"
						></span>
					{/each}
				</div>
			{/each}
		</div>
		<!-- white@80 over ink is ~11.4:1 — hand-verified (composited alpha, see above).
			 The legend swatches are decorative duplicates of the text beside them
			 (the "taken" swatch alone is only ~2.3:1 against ink), which is why every
			 swatch is paired with its own label: SC 1.4.1 is met by the text, and
			 SC 1.4.11 does not bite on graphics that carry no unique information. -->
		<div class="mt-4 flex justify-between text-[11px] text-[hsl(var(--poster-white)/0.8)]">
			<span
				><span class="mr-1 inline-block h-2 w-2 rounded-full bg-[hsl(var(--poster-amber))]"
				></span>{m['home.poster.seatMockParterre']()}</span
			>
			<span
				><span class="mr-1 inline-block h-2 w-2 rounded-full bg-[hsl(var(--poster-periwinkle))]"
				></span>{m['home.poster.seatMockBalcony']()}</span
			>
			<span
				><span class="mr-1 inline-block h-2 w-2 rounded-full bg-[hsl(var(--poster-white)/0.25)]"
				></span>{m['home.poster.seatMockTaken']()}</span
			>
		</div>
	</div>
</div>
