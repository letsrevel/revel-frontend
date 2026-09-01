<svelte:options namespace="svg" />

<script lang="ts">
	/**
	 * A sector that lives on ANOTHER floor, drawn on the active floor's canvas as
	 * an onion-skin ghost (#852 visual language).
	 *
	 * This is the buyer map's `SeatMapGhostSector` treatment applied to the
	 * designer: the real footprint and seat positions, faint (white@4 body,
	 * white@10 edge, white@20 dots one size down) so the floor being arranged is
	 * always the loudest thing in frame. It exists purely so a block is not
	 * placed blind on top of the floor below it.
	 *
	 * Deliberately inert: `aria-hidden` (the floor bar and the active floor's own
	 * blocks are the accessible model of the venue) and `pointer-events-none`, so
	 * a drag across a ghost still pans the canvas and nothing here can be
	 * selected, moved or focused. Being non-interactive and carrying no unique
	 * information, the faint values owe no 1.4.11 floor — only the NAME does, and
	 * it is white@50 (5.18:1 on the house), the same value the buyer's ghost
	 * sector labels use.
	 */
	import type { Coordinate2d } from '$lib/api/generated/types.gen';
	import type { DesignerBlock } from './designer-model';

	interface Props {
		block: DesignerBlock;
		/** The block's live outline (controller state), or null. */
		shape: Coordinate2d[] | null;
		/** Placement in canvas pixels, e.g. `translate(x y) rotate(deg)`. */
		transform: string;
		/** Pixels per world unit (the canvas CELL). */
		cell: number;
		/** Seat dot radius in px on the active floor — ghosts draw smaller. */
		seatR: number;
		/** Upright label position in CANVAS space (never rotated with the block). */
		label: { x: number; y: number };
	}

	const { block, shape, transform, cell, seatR, label }: Props = $props();
</script>

<g aria-hidden="true" class="pointer-events-none">
	<text
		x={label.x}
		y={label.y}
		text-anchor="middle"
		class="fill-poster-white/50 text-[11px] font-medium"
	>
		{block.name}
	</text>
	<g {transform}>
		{#if shape && shape.length >= 3}
			<polygon
				points={shape.map((p) => `${p.x * cell},${p.y * cell}`).join(' ')}
				class="fill-poster-white/[0.04] stroke-poster-white/[0.10]"
				stroke-width="1"
			/>
		{:else}
			<rect
				x="0"
				y="0"
				width={block.width * cell}
				height={block.height * cell}
				rx="10"
				class="fill-poster-white/[0.03] stroke-poster-white/[0.10]"
				stroke-dasharray={block.hasSeats ? undefined : '6 4'}
				stroke-width="1"
			/>
		{/if}
		{#each block.seats as seat (seat.id)}
			<circle
				cx={(seat.x + 0.5) * cell}
				cy={(seat.y + 0.5) * cell}
				r={Math.max(seatR - 3, 1)}
				class="fill-poster-white/20"
			/>
		{/each}
	</g>
</g>
