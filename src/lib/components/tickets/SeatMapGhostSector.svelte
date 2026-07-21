<svelte:options namespace="svg" />

<script lang="ts">
	import type { SectorLayout } from './seat-map-layout';

	interface Props {
		sector: SectorLayout;
		/** Why the sector is inert ("sold through a different ticket" / "no tickets on sale"). */
		label: string;
		/** Pixels per layout unit (SeatMap's CELL). */
		cell: number;
		/** Seat dot radius in px (SeatMap's SEAT_R). */
		seatR: number;
	}

	const { sector, label, cell, seatR }: Props = $props();
</script>

<!--
	Ghost sector for the whole-venue context view and the map-first overview:
	real footprint and seat positions, but dimmed uniform dots — deliberately
	NOT the sold/blocked X pattern, because these seats aren't unavailable,
	they're just not sold through this surface (`label` says why). One inert
	labelled group; nothing focusable inside. Rendered in sector-LOCAL
	coordinates — the caller wraps it in the placing/rotating transform.
-->
<g role="img" aria-label="{sector.name}: {label}" class="opacity-60">
	<title>{sector.name}: {label}</title>
	{#if sector.kind === 'standing'}
		<rect
			x="0"
			y="0"
			width={sector.width * cell}
			height={sector.height * cell}
			rx="12"
			class="fill-muted/25 stroke-border/60"
			stroke-dasharray="6 4"
			stroke-width="1.5"
		/>
	{:else}
		{#if sector.shape}
			<polygon
				points={sector.shape.map((p) => `${p.x * cell},${p.y * cell}`).join(' ')}
				class="fill-muted/20 stroke-border/40"
				stroke-width="1"
			/>
		{:else}
			<rect
				x={-6}
				y={-6}
				width={sector.width * cell + 12}
				height={sector.height * cell + 12}
				rx="10"
				class="fill-muted/15 stroke-border/40"
				stroke-width="1"
			/>
		{/if}
		{#each sector.seats as pt (pt.seatId)}
			<circle
				cx={(pt.x + 0.5) * cell}
				cy={(pt.y + 0.5) * cell}
				r={seatR - 3}
				class="fill-muted-foreground/15"
			/>
		{/each}
	{/if}
</g>
