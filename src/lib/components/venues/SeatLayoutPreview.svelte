<!-- src/lib/components/venues/SeatLayoutPreview.svelte -->
<script lang="ts">
	/**
	 * Thumbnail of a baked sector (the shape-fit dialog's picture). Same room,
	 * same language as the editor canvas and the buyer's map (#852): solid seat
	 * dots on the poster-ink house, the landing mock's stage pill, price-category
	 * colours inline because they are user data.
	 */
	import * as m from '$lib/paraglide/messages.js';
	import type { Coordinate2d } from '$lib/api/generated/types.gen';
	import { seatFill } from '$lib/components/tickets/seat-map-paint';

	export interface PreviewSeat {
		key: string;
		x: number;
		y: number;
		categoryColor: string | null;
	}

	interface Props {
		seats: PreviewSeat[];
		shape?: Coordinate2d[] | null;
		proposedShape?: Coordinate2d[] | null;
		/**
		 * Mirrors the editor's row inversion. Baked positions NEVER flip under it
		 * (frozen bake contract), so an inverted sector's front row — rank 0, the
		 * one next to the stage — is the one with the LARGEST y. The stage bar
		 * therefore has to move to the bottom edge, or the preview would show the
		 * front row furthest from the stage and contradict both the seat grid
		 * (which always draws the stage-adjacent row first) and the curve help.
		 */
		invertRowOrder?: boolean;
	}

	const { seats, shape = null, proposedShape = null, invertRowOrder = false }: Props = $props();

	const CELL = 24;
	const SEAT_R = 8;
	const PAD = 1; // units of padding around content
	const STAGE_H = 14;
	const STAGE_GAP = 8;

	// Bounds stay in world UNITS (not pixels) and only size/position the
	// viewBox — seat and polygon coordinates below are left in raw world-pixel
	// space, the same cell-center idiom SeatMap.svelte uses for its sector-local
	// leaves ((x + 0.5) * CELL, untranslated); global placement is the
	// viewBox's job, not the leaf coordinates'.
	const bounds = $derived.by(() => {
		const pts: Coordinate2d[] = [
			...seats.map((s) => ({ x: s.x, y: s.y })),
			...(shape ?? []),
			...(proposedShape ?? [])
		];
		if (pts.length === 0) return { minX: 0, minY: 0, width: 4, height: 2 };
		const xs = pts.map((p) => p.x);
		const ys = pts.map((p) => p.y);
		const minX = Math.min(...xs) - PAD;
		const minY = Math.min(...ys) - PAD;
		return {
			minX,
			minY,
			width: Math.max(...xs) + 1 + PAD - minX,
			height: Math.max(...ys) + 1 + PAD - minY
		};
	});

	// The stage band is extra viewBox room OUTSIDE the seat bounds — above them
	// for a normal sector, below them for an inverted one (see `invertRowOrder`).
	// Seat and polygon coordinates are untouched either way: only the band moves.
	const vbX = $derived(bounds.minX * CELL);
	const vbY = $derived(bounds.minY * CELL - (invertRowOrder ? 0 : STAGE_H + STAGE_GAP));
	const vbW = $derived(bounds.width * CELL);
	const vbH = $derived(bounds.height * CELL + STAGE_H + STAGE_GAP);
	const stageY = $derived(invertRowOrder ? vbY + vbH - STAGE_H : vbY);

	function cx(x: number): number {
		return (x + 0.5) * CELL;
	}
	function cy(y: number): number {
		return (y + 0.5) * CELL;
	}
	function polyPoints(polygon: Coordinate2d[]): string {
		return polygon.map((p) => `${p.x * CELL},${p.y * CELL}`).join(' ');
	}
</script>

<div class="rounded-[20px] bg-poster-ink p-3">
	<svg
		viewBox="{vbX} {vbY} {vbW} {vbH}"
		class="h-auto w-full"
		role="img"
		aria-label={m['seatGridEditor.geometry.previewAria']()}
	>
		<!-- The mock's stage pill. It stays a <rect> (fully rounded rather than
		     round-top/flat-bottom) because at thumbnail scale the two read the
		     same, and the placement tests address it by y/height. white@14 over
		     ink puts the full-white label at 11.42:1 — hand-verified. -->
		<rect
			x={vbX + vbW * 0.25}
			y={stageY}
			width={vbW * 0.5}
			height={STAGE_H}
			rx={STAGE_H / 2}
			data-testid="preview-stage"
			class="fill-poster-white/[0.14]"
		/>
		<text
			x={vbX + vbW * 0.5}
			y={stageY + STAGE_H - 4}
			text-anchor="middle"
			class="fill-poster-white text-[7px] font-extrabold uppercase tracking-[0.2em]"
		>
			{m['seatGridEditor.geometry.previewStage']()}
		</text>
		{#if shape}
			<polygon
				points={polyPoints(shape)}
				fill="none"
				stroke="hsl(var(--poster-white) / 0.35)"
				stroke-width="1.5"
			/>
		{/if}
		{#if proposedShape}
			<polygon
				points={polyPoints(proposedShape)}
				fill="none"
				stroke="hsl(var(--poster-amber))"
				stroke-width="1.5"
				stroke-dasharray="4 3"
			/>
		{/if}
		{#each seats as seat (seat.key)}
			<circle cx={cx(seat.x)} cy={cy(seat.y)} r={SEAT_R} fill={seatFill(seat.categoryColor)} />
		{/each}
	</svg>
</div>
