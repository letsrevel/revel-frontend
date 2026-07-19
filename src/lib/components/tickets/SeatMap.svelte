<script lang="ts">
	/**
	 * SVG seat map (#659, v1 core — pure rendering, no dialog integration).
	 *
	 * Geometry comes from seat-map-layout.ts (unit space, scaled to pixels
	 * here); seat statuses come from the `seats` prop built via
	 * seating-view.buildSeatViews (source of truth). Seats are colored by
	 * status FIRST and never by color alone: mine gets a check glyph,
	 * sold/held/blocked get a diagonal pattern plus an X glyph, pending
	 * pulses, and price-category color accents always pair with the category
	 * name in the seat's accessible name and hover title.
	 */
	import * as m from '$lib/paraglide/messages.js';
	import type { PriceCategorySchema, VenueChartSchema } from '$lib/api/generated/types.gen';
	import { Minus, Plus, RotateCcw } from '@lucide/svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { computeSeatMapLayout, type SeatPoint, type SectorLayout } from './seat-map-layout';
	import { applyTransform, stageDirectionAngle } from './sector-transform';
	import { rowsFromSeatViews, seatAriaLabel, type SeatView } from './seating-view';

	interface Props {
		chart: VenueChartSchema;
		/** Status source of truth (from seating-view buildSeatViews). */
		seats: SeatView[];
		/** Fired only for available/mine seats (respecting maxReached/disabled). */
		onToggle?: (seatId: string) => void;
		/** Quantity reached: available seats become inert (mine stays togglable). */
		maxReached?: boolean;
		/** Disable all seat interaction (e.g. while confirming the purchase). */
		disabled?: boolean;
		/** false renders a purely presentational map (no focusable seats). */
		interactive?: boolean;
		/** Standing-zone occupancy, keyed by sector id. */
		standingCounts?: Record<string, { capacity: number; taken: number }>;
	}

	const {
		chart,
		seats,
		onToggle,
		maxReached = false,
		disabled = false,
		interactive = true,
		standingCounts
	}: Props = $props();

	const uid = $props.id();

	// Pixels per layout unit and derived canvas geometry.
	const CELL = 32;
	const SEAT_R = 11;
	const PAD = 16;
	const STAGE_H = 24;
	const LABEL_H = 16;
	const OFFSET_Y = PAD + STAGE_H + 12 + LABEL_H;
	/** Room around a scoped sector for its angled stage indicator (compact so
	    the seats stay the dominant content). */
	const SCOPED_MARGIN = 46;

	const layout = $derived(computeSeatMapLayout(chart));

	// A chart filtered to a single sector (the common tier picker) renders that
	// sector UN-ROTATED so its rows stay axis-aligned and scannable; the stage
	// indicator instead points at the angle the sector actually faces the stage
	// (stageDirectionAngle). A full multi-sector map honors each sector's
	// rotation and draws one stage marker at the venue's world "up".
	const scoped = $derived(layout.sectors.length === 1);
	const onlySector = $derived(scoped ? layout.sectors[0] : null);

	const contentW = $derived(
		onlySector
			? Math.max(onlySector.width * CELL + SCOPED_MARGIN * 2, 240)
			: Math.max(layout.width * CELL + PAD * 2, 240)
	);
	const contentH = $derived(
		onlySector
			? onlySector.height * CELL + SCOPED_MARGIN * 2
			: OFFSET_Y + layout.height * CELL + PAD
	);

	const stageLabel = m['seatSelector.stage']();

	/** World-space AABB of a sector's local frame under its transform (units). */
	function worldAABB(sector: SectorLayout) {
		const corners: Array<{ x: number; y: number }> = [
			{ x: 0, y: 0 },
			{ x: sector.width, y: 0 },
			{ x: sector.width, y: sector.height },
			{ x: 0, y: sector.height }
		].map((corner) => applyTransform(corner, sector.transform));
		const xs = corners.map((c) => c.x);
		const ys = corners.map((c) => c.y);
		return {
			minX: Math.min(...xs),
			minY: Math.min(...ys),
			maxX: Math.max(...xs),
			maxY: Math.max(...ys)
		};
	}

	/** Map world units to canvas pixels (full-map placement). */
	function canvasX(worldX: number): number {
		return PAD + (worldX - layout.minX) * CELL;
	}
	function canvasY(worldY: number): number {
		return OFFSET_Y + (worldY - layout.minY) * CELL;
	}

	const seatById = $derived(new Map(seats.map((seat) => [seat.id, seat])));
	const categoryById = $derived(
		new Map(
			(chart.price_categories ?? [])
				.filter((category): category is PriceCategorySchema & { id: string } =>
					Boolean(category.id)
				)
				.map((category) => [category.id, category])
		)
	);
	const seatCategoryId = $derived(
		new Map(
			(chart.sectors ?? []).flatMap((sector) =>
				(sector.seats ?? [])
					.filter((seat) => seat.price_category_id)
					.map((seat) => [seat.id, seat.price_category_id as string] as const)
			)
		)
	);

	function categoryFor(seatId: string): PriceCategorySchema | undefined {
		const categoryId = seatCategoryId.get(seatId);
		return categoryId ? categoryById.get(categoryId) : undefined;
	}

	/** Accessible name: shared SeatSelector wording + price-category suffix. */
	function seatLabelFor(pt: SeatPoint, view: SeatView | undefined): string {
		const base = view
			? seatAriaLabel(view)
			: `${m['seatSelector.seat']()} ${pt.label}, ${m['seatSelector.statusBlocked']()}`;
		const category = categoryFor(pt.seatId);
		return category ? `${base}, ${category.name}` : base;
	}

	// --- toggling -----------------------------------------------------------
	function canToggle(view: SeatView): boolean {
		if (!interactive || disabled || !onToggle) return false;
		if (view.status === 'mine') return true;
		return view.status === 'available' && !maxReached;
	}

	function handleSeatClick(view: SeatView) {
		if (suppressClick) return;
		rovingId = view.id;
		if (!canToggle(view)) return;
		onToggle?.(view.id);
	}

	// --- roving tabindex (row-by-row, rowsFromSeatViews ordering) -----------
	const navRows = $derived(rowsFromSeatViews(seats));
	let rovingId = $state<string | null>(null);
	const activeRovingId = $derived(
		rovingId && seatById.has(rovingId) ? rovingId : (navRows[0]?.seats[0]?.id ?? null)
	);

	const ARROW_DELTAS: Record<string, [number, number]> = {
		ArrowLeft: [0, -1],
		ArrowRight: [0, 1],
		ArrowUp: [-1, 0],
		ArrowDown: [1, 0]
	};

	function handleSeatKeydown(event: KeyboardEvent, view: SeatView) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			rovingId = view.id;
			if (canToggle(view)) onToggle?.(view.id);
			return;
		}
		const delta = ARROW_DELTAS[event.key];
		if (!delta) return;
		event.preventDefault();
		moveFocus(view, delta[0], delta[1]);
	}

	function moveFocus(from: SeatView, rowDelta: number, colDelta: number) {
		const rowIndex = navRows.findIndex((row) => row.seats.some((seat) => seat.id === from.id));
		if (rowIndex === -1) return;
		const colIndex = navRows[rowIndex].seats.findIndex((seat) => seat.id === from.id);
		const targetRowIndex = Math.min(Math.max(rowIndex + rowDelta, 0), navRows.length - 1);
		const rowSeats = navRows[targetRowIndex].seats;
		const target = rowSeats[Math.min(Math.max(colIndex + colDelta, 0), rowSeats.length - 1)];
		if (!target || target.id === from.id) return;
		rovingId = target.id;
		const el = svgEl?.querySelector(`[data-seat-id="${CSS.escape(target.id)}"]`);
		(el as { focus?: () => void } | null)?.focus?.();
	}

	// --- pan & zoom (viewBox-fixed, inner <g> transform) --------------------
	let svgEl = $state<SVGSVGElement>();
	let scale = $state(1);
	let tx = $state(0);
	let ty = $state(0);

	const MIN_SCALE = 0.5;
	const MAX_SCALE = 5;

	function zoomAt(px: number, py: number, factor: number) {
		const next = Math.min(Math.max(scale * factor, MIN_SCALE), MAX_SCALE);
		const k = next / scale;
		tx = px - (px - tx) * k;
		ty = py - (py - ty) * k;
		scale = next;
	}

	function zoomBy(factor: number) {
		zoomAt(contentW / 2, contentH / 2, factor);
	}

	function resetView() {
		scale = 1;
		tx = 0;
		ty = 0;
	}

	function clientToView(clientX: number, clientY: number): { x: number; y: number } | null {
		const rect = svgEl?.getBoundingClientRect();
		if (!rect || rect.width === 0 || rect.height === 0) return null;
		return {
			x: ((clientX - rect.left) / rect.width) * contentW,
			y: ((clientY - rect.top) / rect.height) * contentH
		};
	}

	/** Wheel zoom needs a non-passive listener (Svelte's onwheel is passive). */
	function wheelZoom(node: SVGSVGElement) {
		const onWheel = (event: WheelEvent) => {
			event.preventDefault();
			const point = clientToView(event.clientX, event.clientY);
			const factor = Math.pow(1.0015, -event.deltaY);
			if (point) {
				zoomAt(point.x, point.y, factor);
			} else {
				zoomBy(factor);
			}
		};
		node.addEventListener('wheel', onWheel, { passive: false });
		return {
			destroy: () => node.removeEventListener('wheel', onWheel)
		};
	}

	// Single-pointer drag pans; two pointers pinch-zoom. A drag beyond a small
	// threshold suppresses the click that fires on release (so panning over a
	// seat never toggles it).
	const pointers = new SvelteMap<number, { x: number; y: number }>();
	let suppressClick = false;

	function onPointerDown(event: PointerEvent) {
		pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		if (pointers.size === 1) suppressClick = false;
	}

	function onPointerMove(event: PointerEvent) {
		const prev = pointers.get(event.pointerId);
		if (!prev) return;
		const current = { x: event.clientX, y: event.clientY };
		if (pointers.size === 1) {
			const rect = svgEl?.getBoundingClientRect();
			if (rect && rect.width > 0 && rect.height > 0) {
				tx += ((current.x - prev.x) / rect.width) * contentW;
				ty += ((current.y - prev.y) / rect.height) * contentH;
			}
			if (Math.abs(current.x - prev.x) + Math.abs(current.y - prev.y) > 2) {
				suppressClick = true;
			}
		} else if (pointers.size === 2) {
			const other = [...pointers.entries()].find(([id]) => id !== event.pointerId)?.[1];
			if (other) {
				const prevDist = Math.hypot(prev.x - other.x, prev.y - other.y);
				const nextDist = Math.hypot(current.x - other.x, current.y - other.y);
				if (prevDist > 0) {
					const mid = clientToView((current.x + other.x) / 2, (current.y + other.y) / 2);
					if (mid) zoomAt(mid.x, mid.y, nextDist / prevDist);
				}
				suppressClick = true;
			}
		}
		pointers.set(event.pointerId, current);
	}

	function onPointerEnd(event: PointerEvent) {
		pointers.delete(event.pointerId);
	}

	// --- standing zones -----------------------------------------------------
	const standingLabelText = m['seatMap.standing']();

	function standingCountText(sectorId: string): string | null {
		const counts = standingCounts?.[sectorId];
		if (!counts) return null;
		return `${Math.max(counts.capacity - counts.taken, 0)}/${counts.capacity}`;
	}

	const controlClass =
		'flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background/90 ' +
		'text-foreground shadow-sm transition-colors hover:bg-muted ' +
		'[@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11';
</script>

{#snippet seatShape(pt: SeatPoint, view: SeatView | undefined, cx: number, cy: number)}
	{@const status = view?.status ?? 'blocked'}
	{@const category = categoryFor(pt.seatId)}
	<title>{seatLabelFor(pt, view)}</title>
	{#if status === 'mine'}
		<circle {cx} {cy} r={SEAT_R + 3} class="fill-none stroke-primary/40" stroke-width="2" />
		<circle {cx} {cy} r={SEAT_R} class="fill-primary stroke-primary" />
		<path
			d="M {cx - 4.5} {cy + 0.5} l 3 3 l 6 -7"
			class="stroke-primary-foreground"
			stroke-width="2"
			fill="none"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	{:else if status === 'pending'}
		<circle
			{cx}
			{cy}
			r={SEAT_R}
			class="animate-pulse fill-primary/15 stroke-primary/60"
			stroke-width="2"
		/>
	{:else if status === 'available'}
		<circle
			{cx}
			{cy}
			r={SEAT_R}
			class="fill-background {category ? '' : 'stroke-border'} {maxReached || disabled
				? 'opacity-50'
				: ''}"
			stroke={category?.color}
			stroke-width="2"
		/>
	{:else}
		<!-- sold / held / blocked: diagonal pattern + X glyph, not color alone -->
		<circle
			{cx}
			{cy}
			r={SEAT_R}
			fill="url(#{uid}-unavailable)"
			class="stroke-border/50"
			stroke-width="1.5"
		/>
		<path
			d="M {cx - 3.5} {cy - 3.5} l 7 7 M {cx + 3.5} {cy - 3.5} l -7 7"
			class="stroke-muted-foreground/60"
			stroke-width="1.5"
			fill="none"
			stroke-linecap="round"
		/>
	{/if}
{/snippet}

<!--
	Sector body in sector-LOCAL coordinates (origin 0,0). The caller wraps it in
	a <g transform="translate(...) rotate(...)"> so placement/rotation are purely
	visual: seat <g> roles, aria-labels, roving tabindex, onToggle and category
	coloring are untouched by the group transform. Seats carry no visible number
	label, so nothing needs counter-rotating for legibility; the sector name is
	drawn upright OUTSIDE this group by the caller.
-->
{#snippet sectorBody(sector: SectorLayout)}
	{#if sector.kind === 'standing'}
		{@const counts = standingCountText(sector.id)}
		{@const zoneLabel = counts
			? `${sector.name}, ${standingLabelText}, ${counts}`
			: `${sector.name}, ${standingLabelText}`}
		<g role="img" aria-label={zoneLabel}>
			<title>{zoneLabel}</title>
			<rect
				x="0"
				y="0"
				width={sector.width * CELL}
				height={sector.height * CELL}
				rx="12"
				class="fill-muted/40 stroke-border"
				stroke-dasharray="6 4"
				stroke-width="1.5"
			/>
			<text
				x={(sector.width * CELL) / 2}
				y={(sector.height * CELL) / 2}
				text-anchor="middle"
				dominant-baseline="central"
				class="fill-muted-foreground text-[11px]"
			>
				{counts ? `${standingLabelText} · ${counts}` : standingLabelText}
			</text>
		</g>
	{:else}
		{#if sector.shape}
			<polygon
				points={sector.shape.map((p) => `${p.x * CELL},${p.y * CELL}`).join(' ')}
				class="fill-muted/30 stroke-border/60"
				stroke-width="1"
			/>
		{:else}
			<rect
				x={-6}
				y={-6}
				width={sector.width * CELL + 12}
				height={sector.height * CELL + 12}
				rx="10"
				class="fill-muted/20 stroke-border/50"
				stroke-width="1"
			/>
		{/if}
		{#each sector.seats as pt (pt.seatId)}
			{@const view = seatById.get(pt.seatId)}
			{@const cx = (pt.x + 0.5) * CELL}
			{@const cy = (pt.y + 0.5) * CELL}
			{#if interactive && view}
				<g
					data-seat-id={pt.seatId}
					role="button"
					tabindex={pt.seatId === activeRovingId ? 0 : -1}
					aria-label={seatLabelFor(pt, view)}
					aria-pressed={view.status === 'mine'}
					aria-disabled={canToggle(view) ? undefined : true}
					aria-busy={view.status === 'pending' ? true : undefined}
					class="{canToggle(view)
						? 'cursor-pointer'
						: 'cursor-not-allowed'} outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
					onclick={() => handleSeatClick(view)}
					onkeydown={(event) => handleSeatKeydown(event, view)}
				>
					{@render seatShape(pt, view, cx, cy)}
				</g>
			{:else}
				<g data-seat-id={pt.seatId} aria-hidden="true">
					{@render seatShape(pt, view, cx, cy)}
				</g>
			{/if}
		{/each}
	{/if}
{/snippet}

<!--
	Scoped-view stage indicator: a "STAGE" pill placed at the angle the sector
	faces the venue stage (stageDirectionAngle, degrees clockwise from
	screen-up). The sector renders un-rotated, so an angled section shows the
	stage off at the correct relative angle instead of always at the top.
-->
{#snippet stageArrow(sector: SectorLayout)}
	{@const angle = stageDirectionAngle(sector.transform)}
	{@const rad = (angle * Math.PI) / 180}
	{@const dirX = Math.sin(rad)}
	{@const dirY = -Math.cos(rad)}
	{@const halfW = (sector.width * CELL) / 2}
	{@const halfH = (sector.height * CELL) / 2}
	{@const cx = SCOPED_MARGIN + halfW}
	{@const cy = SCOPED_MARGIN + halfH}
	<!-- Distance from center to the sector's bounding-box edge along the stage
	     direction, plus a small gap — so the indicator hugs the seats instead of
	     floating a half-diagonal away. -->
	{@const edge =
		1 / Math.max(Math.abs(dirX) / Math.max(halfW, 1), Math.abs(dirY) / Math.max(halfH, 1))}
	{@const radius = edge + 30}
	{@const px = cx + dirX * radius}
	{@const py = cy + dirY * radius}
	<g role="img" aria-label={stageLabel}>
		<line
			x1={cx + dirX * (radius - 14)}
			y1={cy + dirY * (radius - 14)}
			x2={cx + dirX * (radius - 30)}
			y2={cy + dirY * (radius - 30)}
			class="stroke-muted-foreground"
			stroke-width="2"
			stroke-linecap="round"
		/>
		<rect x={px - 30} y={py - 11} width="60" height="22" rx="8" class="fill-muted" />
		<text
			x={px}
			y={py}
			text-anchor="middle"
			dominant-baseline="central"
			class="fill-muted-foreground text-[11px] font-medium tracking-widest"
		>
			{stageLabel}
		</text>
	</g>
{/snippet}

<div class="relative">
	<svg
		bind:this={svgEl}
		use:wheelZoom
		viewBox="0 0 {contentW} {contentH}"
		preserveAspectRatio="xMidYMid meet"
		class="h-full w-full touch-none select-none"
		role="group"
		aria-label={m['seatMap.label']()}
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		onpointerup={onPointerEnd}
		onpointercancel={onPointerEnd}
		onpointerleave={onPointerEnd}
	>
		<defs>
			<pattern
				id="{uid}-unavailable"
				patternUnits="userSpaceOnUse"
				width="5"
				height="5"
				patternTransform="rotate(45)"
			>
				<rect width="5" height="5" class="fill-muted/60" />
				<line x1="0" y1="0" x2="0" y2="5" class="stroke-muted-foreground/30" stroke-width="2" />
			</pattern>
		</defs>
		<g transform="translate({tx} {ty}) scale({scale})">
			{#if onlySector}
				<!-- Scoped single-sector view: render un-rotated with the stage arrow
				     at the angle this sector faces the stage. -->
				{@render stageArrow(onlySector)}
				<text
					x={SCOPED_MARGIN + 2}
					y={SCOPED_MARGIN - 6}
					class="fill-muted-foreground text-[11px] font-medium"
				>
					{onlySector.name}
				</text>
				<g transform="translate({SCOPED_MARGIN} {SCOPED_MARGIN})">
					{@render sectorBody(onlySector)}
				</g>
			{:else}
				<!-- Full map: one stage marker at the venue's world "up", each sector
				     placed+rotated by its transform. -->
				<g role="img" aria-label={stageLabel}>
					<rect
						x={contentW / 2 - 60}
						y={PAD}
						width="120"
						height={STAGE_H}
						rx="8"
						class="fill-muted"
					/>
					<text
						x={contentW / 2}
						y={PAD + STAGE_H / 2}
						text-anchor="middle"
						dominant-baseline="central"
						class="fill-muted-foreground text-[11px] font-medium tracking-widest"
					>
						{stageLabel}
					</text>
				</g>

				{#each layout.sectors as sector (sector.id)}
					{@const aabb = worldAABB(sector)}
					<!-- Sector name upright in canvas space (never rotated), centered
					     above the sector's world bounding box. -->
					<text
						x={canvasX((aabb.minX + aabb.maxX) / 2)}
						y={canvasY(aabb.minY) - 6}
						text-anchor="middle"
						class="fill-muted-foreground text-[11px] font-medium"
					>
						{sector.name}
					</text>
					<g
						transform="translate({canvasX(sector.transform.x)} {canvasY(
							sector.transform.y
						)}) rotate({sector.transform.rotation})"
					>
						{@render sectorBody(sector)}
					</g>
				{/each}
			{/if}
		</g>
	</svg>

	<!-- Zoom controls -->
	<div class="absolute right-2 top-2 flex flex-col gap-1">
		<button
			type="button"
			class={controlClass}
			aria-label={m['seatMap.zoomIn']()}
			onclick={() => zoomBy(1.25)}
		>
			<Plus class="h-4 w-4" aria-hidden="true" />
		</button>
		<button
			type="button"
			class={controlClass}
			aria-label={m['seatMap.zoomOut']()}
			onclick={() => zoomBy(0.8)}
		>
			<Minus class="h-4 w-4" aria-hidden="true" />
		</button>
		<button
			type="button"
			class={controlClass}
			aria-label={m['seatMap.zoomReset']()}
			onclick={resetView}
		>
			<RotateCcw class="h-4 w-4" aria-hidden="true" />
		</button>
	</div>
</div>
