<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import PosterSticker from './PosterSticker.svelte';
</script>

<!-- Decorative: the whole card is one `role="img"` with a single accessible name,
	 so every inner layer is aria-hidden and screen readers never walk the mock. -->
<div
	role="img"
	aria-label={m['home.poster.qMockAria']()}
	class="relative w-80 max-w-full rotate-2 rounded-[20px] bg-[hsl(var(--poster-white))] p-5 shadow-[0_10px_30px_hsl(var(--poster-ink)/0.25)]"
>
	<div class="pointer-events-none absolute -top-3.5 right-4" aria-hidden="true">
		<PosterSticker tint="purple" rotate={3} class="text-sm"
			>{m['home.poster.qMockSticker']()}</PosterSticker
		>
	</div>
	<div aria-hidden="true">
		<p
			class="text-[11px] font-extrabold uppercase tracking-[0.1em] text-[hsl(var(--poster-purple))]"
		>
			{m['home.poster.qMockLabel']()}
		</p>
		<p class="mt-2.5 font-bold text-[hsl(var(--poster-ink))]">
			{m['home.poster.qMockQuestion']()}
		</p>
		<div class="mt-2.5 flex flex-col gap-1.5 text-sm">
			<!-- ink@72% composited on the WHITE card is 6.92:1 — audited as a
				 COMPOSITED_PAIRS row in scripts/audit-brand-themes.py (issue #783).
				 The comment here previously claimed ~9.7:1, which the script does not
				 reproduce; FeaturesPanel measured the identical recipe at "6.8". -->
			<div
				class="rounded-[10px] border-2 border-[hsl(var(--poster-paper))] px-3 py-2 text-[hsl(var(--poster-ink)/0.72)]"
			>
				{m['home.poster.qMockOpt1']()}
			</div>
			<div
				class="rounded-[10px] border-2 border-[hsl(var(--poster-purple))] bg-[hsl(var(--poster-purple)/0.08)] px-3 py-2 font-semibold text-[hsl(var(--poster-ink))]"
			>
				{m['home.poster.qMockOpt2']()} ✓
			</div>
			<div
				class="rounded-[10px] border-2 border-[hsl(var(--poster-paper))] px-3 py-2 text-[hsl(var(--poster-ink)/0.72)]"
			>
				{m['home.poster.qMockOpt3']()}
			</div>
		</div>
		<div class="mt-3.5 flex gap-2 text-sm font-bold">
			<span
				class="rounded-full bg-[hsl(var(--poster-purple))] px-4 py-1.5 text-[hsl(var(--poster-white))]"
			>
				{m['home.poster.qMockApprove']()}
			</span>
			<span
				class="rounded-full bg-[hsl(var(--poster-paper))] px-4 py-1.5 text-[hsl(var(--poster-ink))]"
			>
				{m['home.poster.qMockReject']()}
			</span>
		</div>
	</div>
</div>
