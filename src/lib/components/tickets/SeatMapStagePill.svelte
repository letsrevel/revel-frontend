<script lang="ts">
	/**
	 * The seat map's STAGE marker, drawn at the LOCAL origin (0,0) so the
	 * caller owns placement and rotation via a wrapping `<g transform>`.
	 *
	 * This is the landing SeatMapMock's pill: a white@14 strip on the map's
	 * dark house with a full-opacity white tracked-uppercase label —
	 * 11.42:1, hand-verified, because a composited alpha over a poster value
	 * is invisible to scripts/audit-brand-themes.py. The house is a mode-inert
	 * theatre (scoped `dark` region), so these fixed values are correct in
	 * both modes.
	 *
	 * Extracted verbatim from SeatMap (it drew the same pill twice: the
	 * full-map top marker and the scoped angled bar) — rendering only, no
	 * geometry and no interaction.
	 */
	interface Props {
		/** Already-translated "Stage". Also the caller's `aria-label`. */
		label: string;
		width: number;
		height: number;
		/**
		 * Counter-rotate the label 180°. The bar itself rotates to face the
		 * stage; past 90° that would leave the text upside-down.
		 */
		flip?: boolean;
	}
	const { label, width, height, flip = false }: Props = $props();
</script>

<rect
	x={-width / 2}
	y={-height / 2}
	{width}
	{height}
	rx={height / 2}
	class="fill-poster-white/[0.14]"
/>
<text
	text-anchor="middle"
	dominant-baseline="central"
	transform={flip ? 'rotate(180)' : undefined}
	class="fill-poster-white text-[10px] font-extrabold uppercase tracking-[0.2em]"
>
	{label}
</text>
