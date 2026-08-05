<script lang="ts">
	import { cn } from '$lib/utils';
	import { getImageUrl } from '$lib/utils/url';

	/**
	 * The landing hero's tilted white sticker chip — the poster ornament for a
	 * color-block band — carrying the ORGANIZATION'S OWN logo.
	 *
	 * Sticker-chip rule (spec §9, Biagio): a decorative chip shows the org's
	 * logo when it has one and renders NOTHING when it doesn't. The Revel mark
	 * is never filler on someone else's page — that is what this component
	 * replaced (`brand/MarkChip`, see git history). The landing's own hero chip
	 * is frozen and keeps its Revel mark.
	 *
	 * Purely decorative: the whole chip is `aria-hidden` and the image carries
	 * `alt=""`, because the adjacent copy always names the organization already
	 * (the ribbon's "organized by {name}" strip, the band's kicker). It carries
	 * no copy of its own and never encodes state, so it is safe on any band in
	 * either mode; its mode-inert white follows the imagery rule (it is a
	 * sticker, not a surface).
	 */
	interface Props {
		/** `organization.logo` — the full-size rendition. */
		logo?: string | null;
		/** `organization.logo_thumbnail_url` — preferred when present. */
		logoThumbnail?: string | null;
		/** Degrees, clamped to [-10, 10] — chips tilt harder than Stickers. */
		rotate?: number;
		class?: string;
	}
	const { logo = null, logoThumbnail = null, rotate = 9, class: className = '' }: Props = $props();
	const clamped = $derived(Math.max(-10, Math.min(10, rotate)));
	/** Same resolution order the org profile header uses: thumbnail, then full. */
	const src = $derived(getImageUrl(logoThumbnail || logo));
</script>

{#if src}
	<div
		aria-hidden="true"
		class={cn(
			'pointer-events-none relative rounded-[22px] bg-poster-white p-2.5 shadow-poster',
			className
		)}
		style="transform: rotate({clamped}deg)"
	>
		<img {src} alt="" class="h-12 w-12 rounded-[14px] object-cover" />
	</div>
{/if}
