<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import PosterSticker from './PosterSticker.svelte';

	// A 7×7 "QR" drawn as ink cells on white. Deterministic (no Math.random:
	// SSR-stable) and purely decorative — it never encodes anything.
	const QR = ['1111111', '1000001', '1011101', '1010101', '1011101', '1000001', '1111111'];
	const qrCells = QR.flatMap((row, r) =>
		[...row].map((c, col) => ({ key: `${r}-${col}`, on: c === '1' }))
	);
</script>

<!-- Decorative: the whole card is one `role="img"` with a single accessible name,
	 so every inner layer is aria-hidden and screen readers never walk the mock.
	 Palette: white card on the lavender panel; header band is poster-purple with
	 full-opacity white — 5.52:1 (audit-brand-themes.py, "membership card mock
	 header band"); everything else is ink on white (~17:1). -->
<div
	role="img"
	aria-label={m['home.poster.memberMockAria']()}
	class="w-[340px] max-w-full rotate-2 rounded-[20px] bg-[hsl(var(--poster-white))] shadow-[0_10px_30px_hsl(var(--poster-ink)/0.25)]"
>
	<div class="pointer-events-none relative" aria-hidden="true">
		<div class="absolute -top-4 right-4 z-10">
			<PosterSticker tint="crimson" rotate={3} class="text-sm"
				>{m['home.poster.memberMockSticker']()}</PosterSticker
			>
		</div>
	</div>
	<div aria-hidden="true">
		<!-- The band carries its own top radius: the card must NOT clip overflow, or the
			 sticker riding its top edge gets cut in half. -->
		<div
			class="rounded-t-[20px] bg-[hsl(var(--poster-purple))] px-5 pb-4 pt-5 text-[hsl(var(--poster-white))]"
		>
			<p class="text-[10px] font-extrabold uppercase tracking-[0.2em]">
				{m['home.poster.memberMockOrg']()}
			</p>
			<p class="mt-1 text-xl font-black leading-tight">{m['home.poster.memberMockTier']()}</p>
		</div>
		<div class="flex items-center gap-4 px-5 py-4 text-[hsl(var(--poster-ink))]">
			<!-- QR block: 7×7 ink cells on white, gap-px so it reads as a code. -->
			<div
				class="grid shrink-0 grid-cols-7 gap-px rounded-md border-4 border-[hsl(var(--poster-white))] bg-[hsl(var(--poster-white))] p-0.5 outline outline-2 outline-[hsl(var(--poster-ink))]"
			>
				{#each qrCells as cell (cell.key)}
					<span class="h-2.5 w-2.5 {cell.on ? 'bg-[hsl(var(--poster-ink))]' : ''}"></span>
				{/each}
			</div>
			<div class="min-w-0 flex-1 text-sm">
				<!-- Solid ink, no alpha: the SeatMapMock legend earns its 80% on ink;
					 here the surface is white and the hierarchy comes from weight. -->
				<p class="font-bold">{m['home.poster.memberMockStatus']()}</p>
				<p class="mt-2 font-semibold">{m['home.poster.memberMockClass']()}</p>
				<!-- Ink on amber: 9.42:1 (audit-brand-themes.py, "membership card mock RSVP chip"). -->
				<p
					class="mt-2 inline-block rounded-full bg-[hsl(var(--poster-amber))] px-3 py-1 text-xs font-extrabold"
				>
					{m['home.poster.memberMockRsvp']()}
				</p>
			</div>
		</div>
	</div>
</div>
