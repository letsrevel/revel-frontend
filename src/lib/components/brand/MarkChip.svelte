<script lang="ts">
	import { cn } from '$lib/utils';
	import RevelMark from './RevelMark.svelte';

	/**
	 * The landing hero's tilted white chip carrying the Revel mark and its two
	 * hearts, promoted out of `landing/poster/HeroPanel` so app surfaces with a
	 * color-block band can carry the same ornament (uplift prototype).
	 *
	 * Purely decorative: the whole chip is `aria-hidden`, carries no copy, and
	 * never encodes state — so it is safe on any band in either mode, and its
	 * mode-inert white follows the imagery rule (it is a sticker, not a
	 * surface). The landing file itself is frozen and keeps its own copy.
	 */
	interface Props {
		/** Degrees, clamped to [-10, 10] — chips tilt harder than Stickers. */
		rotate?: number;
		class?: string;
	}
	const { rotate = 9, class: className = '' }: Props = $props();
	const clamped = $derived(Math.max(-10, Math.min(10, rotate)));
</script>

<div
	aria-hidden="true"
	class={cn(
		'pointer-events-none relative rounded-[22px] bg-poster-white p-2.5 shadow-poster',
		className
	)}
	style="transform: rotate({clamped}deg)"
>
	<RevelMark decorative class="h-12 w-auto" />
	<span class="absolute -left-3 -top-2 text-xl">❤️</span>
	<span class="absolute -bottom-1.5 -right-2 text-sm">❤️</span>
</div>
