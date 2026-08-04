<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * App-facing twin of landing/poster/PosterSticker.svelte (kept separate on
	 * purpose: the landing is frozen and owns its marker classes). Same look:
	 * white sticker with brand-tinted text, ink variant inverts. Fixed poster
	 * palette in BOTH modes (imagery rule) — text/tint pairs are audited token
	 * pairs ("sticker text on white sticker") in audit-brand-themes.py.
	 */
	interface Props {
		/** Text color on the white sticker; 'ink' inverts to ink bg + white text. */
		tint?: 'purple' | 'crimson' | 'ink';
		/** Degrees, clamped to [-3, 3] (tilt discipline, see rebrand spec). */
		rotate?: number;
		class?: string;
		children: Snippet;
	}
	const { tint = 'purple', rotate = -2, class: className = '', children }: Props = $props();
	const clamped = $derived(Math.max(-3, Math.min(3, rotate)));
</script>

<span
	class="inline-block rounded-[0.55em] px-[0.55em] py-[0.18em] font-extrabold shadow-[0_4px_12px_hsl(var(--poster-ink)/0.25)]
		{tint === 'ink' ? 'bg-poster-ink text-poster-white' : 'bg-poster-white'}
		{tint === 'purple' ? 'text-poster-purple' : ''}
		{tint === 'crimson' ? 'text-poster-crimson-deep' : ''}
		{className}"
	style="transform: rotate({clamped}deg)"
>
	{@render children()}
</span>
