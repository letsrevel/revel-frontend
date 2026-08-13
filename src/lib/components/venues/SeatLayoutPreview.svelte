<!-- src/lib/components/venues/SeatLayoutPreview.svelte -->
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { Coordinate2d } from '$lib/api/generated/types.gen';

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
	}

	const { seats, shape = null, proposedShape = null }: Props = $props();

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

	const vbX = $derived(bounds.minX * CELL);
	const vbY = $derived(bounds.minY * CELL - STAGE_H - STAGE_GAP);
	const vbW = $derived(bounds.width * CELL);
	const vbH = $derived(bounds.height * CELL + STAGE_H + STAGE_GAP);

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

<div class="rounded-lg border bg-card p-2">
	<svg
		viewBox="{vbX} {vbY} {vbW} {vbH}"
		class="h-auto w-full"
		role="img"
		aria-label={m['seatGridEditor.geometry.previewAria']()}
	>
		<rect
			x={vbX + vbW * 0.25}
			y={vbY}
			width={vbW * 0.5}
			height={STAGE_H}
			rx="7"
			class="fill-muted"
		/>
		<text
			x={vbX + vbW * 0.5}
			y={vbY + STAGE_H - 4}
			text-anchor="middle"
			class="fill-muted-foreground text-[8px] font-semibold"
		>
			{m['seatGridEditor.geometry.previewStage']()}
		</text>
		{#if shape}
			<polygon
				points={polyPoints(shape)}
				fill="none"
				stroke="hsl(var(--border))"
				stroke-width="1.5"
			/>
		{/if}
		{#if proposedShape}
			<polygon
				points={polyPoints(proposedShape)}
				fill="none"
				stroke="hsl(var(--primary))"
				stroke-width="1.5"
				stroke-dasharray="4 3"
			/>
		{/if}
		{#each seats as seat (seat.key)}
			<circle
				cx={cx(seat.x)}
				cy={cy(seat.y)}
				r={SEAT_R}
				fill={seat.categoryColor ?? 'hsl(var(--primary))'}
				opacity="0.9"
			/>
		{/each}
	</svg>
</div>
