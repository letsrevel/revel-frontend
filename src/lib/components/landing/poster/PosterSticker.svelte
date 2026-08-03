<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** Text color on the white sticker; 'ink' inverts to ink bg + white text. */
		tint?: 'purple' | 'crimson' | 'ink';
		/** Degrees, clamped to [-3, 3] (tilt discipline, see design spec). */
		rotate?: number;
		class?: string;
		children: Snippet;
	}
	const { tint = 'purple', rotate = -2, class: className = '', children }: Props = $props();
	const clamped = $derived(Math.max(-3, Math.min(3, rotate)));
</script>

<span
	class="poster-sticker inline-block rounded-[0.55em] px-[0.55em] py-[0.18em] font-extrabold shadow-[0_4px_12px_hsl(var(--poster-ink)/0.25)]
		{tint === 'ink'
		? 'sticker-ink bg-[hsl(var(--poster-ink))] text-[hsl(var(--poster-white))]'
		: 'bg-[hsl(var(--poster-white))]'}
		{tint === 'purple' ? 'text-[hsl(var(--poster-purple))]' : ''}
		{tint === 'crimson' ? 'text-[hsl(var(--poster-crimson-deep))]' : ''}
		{className}"
	style="transform: rotate({clamped}deg)"
>
	{@render children()}
</span>
