<svelte:options namespace="svg" />

<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { SectorTarget } from '$lib/components/events/venue-overview';
	import type { SectorLayout } from './seat-map-layout';

	interface Props {
		sector: SectorLayout;
		target: SectorTarget;
		/** Pixels per layout unit (SeatMap's CELL). */
		cell: number;
		/** Seat dot radius in px (SeatMap's SEAT_R). */
		seatR: number;
		/** SVG transform placing the sector's local frame into canvas space. */
		groupTransform: string;
		/** Canvas-space AABB of the sector (px) — the click/hover target. */
		box: { x: number; y: number; width: number; height: number };
		onSelect: () => void;
	}

	const { sector, target, cell, seatR, groupTransform, box, onSelect }: Props = $props();

	const standingLabelText = m['seatMap.standing']();

	// Overlay chip sized from the longest line (estimated 11px-medium glyph
	// width — an SVG <text> cannot be measured without a live layout pass).
	const LINE_H = 15;
	const CHAR_W = 6.2;
	const PAD_X = 10;
	const PAD_Y = 7;
	const chipW = $derived(
		Math.max(...target.lines.map((line) => line.length), 4) * CHAR_W + PAD_X * 2
	);
	const chipH = $derived(target.lines.length * LINE_H + PAD_Y * 2);
	const chipX = $derived(box.x + box.width / 2 - chipW / 2);
	const chipY = $derived(box.y + box.height / 2 - chipH / 2);

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			onSelect();
		}
	}
</script>

<!--
	One sector as a single whole-sector click target for the map-first overview
	(#679): seats are deliberately NOT individually interactive here — the
	buyer picks a SECTOR, then routes into the selling tier's purchase dialog.
	The group is keyboard-focusable with the tiers + prices in its accessible
	name; the visible chip repeats the same information (never color alone).
-->
<g
	data-sector-target={sector.id}
	role="button"
	tabindex="0"
	aria-label={target.label}
	class="cursor-pointer outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
	onclick={onSelect}
	onkeydown={handleKeydown}
>
	<title>{target.label}</title>
	<g transform={groupTransform} aria-hidden="true">
		{#if sector.kind === 'standing'}
			<rect
				x="0"
				y="0"
				width={sector.width * cell}
				height={sector.height * cell}
				rx="12"
				class="fill-muted/40 stroke-border"
				stroke-dasharray="6 4"
				stroke-width="1.5"
			/>
			<text
				x={(sector.width * cell) / 2}
				y={(sector.height * cell) / 2}
				text-anchor="middle"
				dominant-baseline="central"
				class="fill-muted-foreground text-[11px]"
			>
				{standingLabelText}
			</text>
		{:else}
			{#if sector.shape}
				<polygon
					points={sector.shape.map((p) => `${p.x * cell},${p.y * cell}`).join(' ')}
					class="fill-muted/30 stroke-border/70"
					stroke-width="1"
				/>
			{:else}
				<rect
					x={-6}
					y={-6}
					width={sector.width * cell + 12}
					height={sector.height * cell + 12}
					rx="10"
					class="fill-muted/25 stroke-border/60"
					stroke-width="1"
				/>
			{/if}
			{#each sector.seats as pt (pt.seatId)}
				<circle
					cx={(pt.x + 0.5) * cell}
					cy={(pt.y + 0.5) * cell}
					r={seatR - 3}
					class="fill-muted-foreground/35"
				/>
			{/each}
		{/if}
	</g>

	<!-- Tier + price chip, upright in canvas space over the sector's center. -->
	<g aria-hidden="true">
		<rect
			x={chipX}
			y={chipY}
			width={chipW}
			height={chipH}
			rx="8"
			class="fill-background/90 stroke-border"
			stroke-width="1"
		/>
		{#each target.lines as line, index (index)}
			<text
				x={box.x + box.width / 2}
				y={chipY + PAD_Y + index * LINE_H + LINE_H / 2}
				text-anchor="middle"
				dominant-baseline="central"
				class="fill-foreground text-[11px] font-medium"
			>
				{line}
			</text>
		{/each}
	</g>

	<!-- Whole-AABB hit area (rendered on top so clicks land on the sector, not
	     in gaps between seat dots) with a hover wash for pointer feedback. -->
	<rect
		x={box.x}
		y={box.y}
		width={box.width}
		height={box.height}
		rx="10"
		class="fill-transparent transition-colors hover:fill-primary/10"
	/>
</g>
