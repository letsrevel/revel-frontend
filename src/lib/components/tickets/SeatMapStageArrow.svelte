<script lang="ts">
	/**
	 * Scoped-view stage indicator: a "STAGE" pill placed at the angle the
	 * sector faces the venue stage (stageDirectionAngle, degrees clockwise
	 * from screen-up). The sector renders un-rotated, so an angled section
	 * shows the stage off at the correct relative angle instead of always at
	 * the top.
	 *
	 * Extracted verbatim from SeatMap's `stageArrow` snippet — every constant,
	 * expression and class is unchanged. Pure geometry + rendering: no state,
	 * no interaction, no seat data.
	 */
	import type { Coordinate2d } from '$lib/api/generated/types.gen';
	import type { SectorLayout } from './seat-map-layout';
	import { sectorWorldCenter, stageDirectionAngle, worldAngleFromUp } from './sector-transform';
	import SeatMapStagePill from './SeatMapStagePill.svelte';

	interface Props {
		sector: SectorLayout;
		/** World position of the venue stage; null falls back to world "up". */
		stage?: Coordinate2d | null;
		/** Already-translated "Stage". */
		label: string;
		/** Pixels per layout unit (SeatMap's CELL). */
		cell: number;
		/** Room around the scoped sector (SeatMap's SCOPED_MARGIN). */
		margin: number;
	}
	const { sector, stage = null, label, cell, margin }: Props = $props();

	const BAR_THICK = 18;
	const GAP = 9;

	const worldAngle = $derived(
		stage
			? worldAngleFromUp(sectorWorldCenter(sector.transform, sector.width, sector.height), stage)
			: 0
	);
	const angle = $derived(stageDirectionAngle(sector.transform, worldAngle));
	const rad = $derived((angle * Math.PI) / 180);
	const dirX = $derived(Math.sin(rad));
	const dirY = $derived(-Math.cos(rad));
	const halfW = $derived((sector.width * cell) / 2);
	const halfH = $derived((sector.height * cell) / 2);
	const cx = $derived(margin + halfW);
	const cy = $derived(margin + halfH);
	/**
	 * Distance from centre to the sector's bounding-box edge along the stage
	 * direction, so the bar hugs the seats instead of floating a half-diagonal
	 * away.
	 */
	const edge = $derived(
		1 / Math.max(Math.abs(dirX) / Math.max(halfW, 1), Math.abs(dirY) / Math.max(halfH, 1))
	);
	const bx = $derived(cx + dirX * (edge + GAP + BAR_THICK / 2));
	const by = $derived(cy + dirY * (edge + GAP + BAR_THICK / 2));
	/**
	 * Bar width tracks the sector's smaller side so it reads as a stage facing
	 * the seats, but stays modest so an angled bar never spills past the margin.
	 */
	const barW = $derived(
		Math.min(Math.max(Math.min(sector.width, sector.height) * cell * 0.6, 60), 88)
	);
	/** Past 90° the bar's own rotation would flip the label upside-down. */
	const flip = $derived(angle > 90 && angle < 270);
</script>

<g role="img" aria-label={label}>
	<!-- Short connector tying the bar to the seat block it faces. -->
	<line
		x1={cx + dirX * edge}
		y1={cy + dirY * edge}
		x2={cx + dirX * (edge + GAP)}
		y2={cy + dirY * (edge + GAP)}
		class="stroke-muted-foreground/50"
		stroke-width="2"
		stroke-linecap="round"
	/>
	<!-- Bar rotated to sit perpendicular to the stage direction (the sector is
	     drawn un-rotated, so this angle conveys where the stage actually is). -->
	<g transform="translate({bx} {by}) rotate({angle})">
		<SeatMapStagePill {label} width={barW} height={BAR_THICK} {flip} />
	</g>
</g>
