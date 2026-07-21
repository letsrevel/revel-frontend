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
	import type {
		Coordinate2d,
		PriceCategorySchema,
		TierSeatPricingSchema,
		VenueChartSchema
	} from '$lib/api/generated/types.gen';
	import { formatMoney } from '$lib/utils/format';
	import { resolveSeatPrice } from './seat-pricing';
	import { Minus, Plus, RotateCcw } from '@lucide/svelte';
	import type { SectorSeatConfig, SectorTarget } from '$lib/components/events/venue-overview';
	import SeatMapGhostSector from './SeatMapGhostSector.svelte';
	import SeatMapSectorTarget from './SeatMapSectorTarget.svelte';
	import { SeatMapViewport } from './seat-map-viewport.svelte';
	import { computeSeatMapLayout, type SeatPoint, type SectorLayout } from './seat-map-layout';
	import {
		applyTransform,
		sectorWorldCenter,
		stageDirectionAngle,
		worldAngleFromUp
	} from './sector-transform';
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
		/**
		 * Whole-venue context mode: when set on a multi-sector chart, only this
		 * sector is interactive; every other sector renders as a GHOST — dimmed
		 * uniform seats, no status glyphs (an X pattern would read as sold-out,
		 * which is a lie: those seats just aren't sold through this ticket).
		 */
		activeSectorId?: string | null;
		/** Standing-zone occupancy, keyed by sector id. */
		standingCounts?: Record<string, { capacity: number; taken: number }>;
		/**
		 * World position of the venue stage (from `Venue.metadata.stage`). When
		 * given, the scoped single-sector view points its stage indicator at the
		 * stage's ACTUAL direction; absent, it falls back to world "up".
		 */
		stage?: Coordinate2d | null;
		/**
		 * Suppress the full-map stage marker entirely (#680): on a multi-floor
		 * venue the stage belongs to the FIRST floor by convention (it has no
		 * floor field), so other floors' views must not render even the
		 * top-center fallback pill.
		 */
		hideStage?: boolean;
		/** Server-resolved per-category prices (user_choice tiers, #668). */
		seatPricing?: TierSeatPricingSchema | null;
		/** Tier currency for price display (seat_pricing carries bare decimals). */
		currency?: string | null;
		/**
		 * Map-first overview mode (#679): when set, the full map renders WHOLE
		 * SECTORS as the click targets — a sector with a target is clickable and
		 * keyboard-focusable (tier names + prices in its accessible name and
		 * visible overlay), every other sector is a dimmed inert ghost. Seats are
		 * never individually interactive in this mode.
		 */
		sectorTargets?: SectorTarget[] | null;
		/** Fired with the sector id when an overview sector target is activated. */
		onSectorSelect?: (sectorId: string) => void;
		/**
		 * Seat-level selection INSIDE overview mode: sectors listed here render
		 * their real interactive seat bodies (statuses from `seats`, per-sector
		 * pricing/currency/cap from the config) while sectors with a target stay
		 * whole-sector click targets and the rest render as ghosts. Ignored
		 * outside overview mode.
		 */
		interactiveSectors?: SectorSeatConfig[] | null;
	}

	const {
		chart,
		seats,
		onToggle,
		maxReached = false,
		disabled = false,
		interactive = true,
		activeSectorId = null,
		standingCounts,
		stage = null,
		hideStage = false,
		seatPricing = null,
		currency = null,
		sectorTargets = null,
		onSectorSelect,
		interactiveSectors = null
	}: Props = $props();

	// Overview mode: whole sectors are the interaction unit (see Props docs) —
	// except sectors with a seat config, whose seats stay individually tappable.
	const overview = $derived(sectorTargets != null);
	const targetsById = $derived(new Map((sectorTargets ?? []).map((t) => [t.sectorId, t])));
	const seatConfigById = $derived(new Map((interactiveSectors ?? []).map((c) => [c.sectorId, c])));
	const seatSectorId = $derived(
		new Map(
			(chart.sectors ?? []).flatMap((sector) =>
				(sector.seats ?? []).map((seat) => [seat.id, sector.id] as const)
			)
		)
	);

	/** Per-sector seat config for a seat, when its sector has one. */
	function sectorConfigFor(seatId: string): SectorSeatConfig | undefined {
		const sectorId = seatSectorId.get(seatId);
		return sectorId ? seatConfigById.get(sectorId) : undefined;
	}

	/** A configured sector's own cap wins over the map-wide maxReached prop. */
	function seatMaxReached(seatId: string): boolean {
		return sectorConfigFor(seatId)?.maxReached ?? maxReached;
	}

	/** Seats are interactive map-wide, or per sector via interactiveSectors. */
	function seatInteractive(seatId: string): boolean {
		return interactive || sectorConfigFor(seatId) !== undefined;
	}

	function handleSectorSelect(sectorId: string): void {
		if (viewport.suppressClick) return;
		onSectorSelect?.(sectorId);
	}

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
	const SCOPED_MARGIN = 52;

	const layout = $derived(computeSeatMapLayout(chart));

	// A chart filtered to a single sector (the common tier picker) renders that
	// sector UN-ROTATED so its rows stay axis-aligned and scannable; the stage
	// indicator instead points at the angle the sector actually faces the stage
	// (stageDirectionAngle). A full multi-sector map honors each sector's
	// rotation and draws one stage marker at the venue's world "up".
	// Whole-venue contexts (overview targets or venue scope with an active
	// sector) must NEVER collapse to the scoped view — a floor-filtered chart
	// (#680) can hold a single sector whose target/ghost rendering, not the
	// scoped stage-arrow view, is what the caller asked for.
	const scoped = $derived(layout.sectors.length === 1 && !overview && activeSectorId == null);
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

	/** Accessible name: shared SeatSelector wording + category & price suffix. */
	function seatLabelFor(pt: SeatPoint, view: SeatView | undefined): string {
		let label = view
			? seatAriaLabel(view)
			: `${m['seatSelector.seat']()} ${pt.label}, ${m['seatSelector.statusBlocked']()}`;
		const category = categoryFor(pt.seatId);
		if (category) label += `, ${category.name}`;
		// Dumb server-resolved lookup — never a locally recomputed fallback
		// chain. A configured sector's own tier pricing wins over the map-wide
		// seatPricing prop (each overview sector is sold by a different tier).
		const config = sectorConfigFor(pt.seatId);
		const priceInfo = resolveSeatPrice(
			config ? config.seatPricing : seatPricing,
			seatCategoryId.get(pt.seatId) ?? null
		);
		if (priceInfo?.available && priceInfo.price != null) {
			label += `, ${formatMoney(priceInfo.price, config ? config.currency : currency)}`;
		}
		return label;
	}

	// --- toggling -----------------------------------------------------------
	function canToggle(view: SeatView): boolean {
		if (!seatInteractive(view.id) || disabled || !onToggle) return false;
		if (view.status === 'mine') return true;
		return view.status === 'available' && !seatMaxReached(view.id);
	}

	function handleSeatClick(view: SeatView) {
		if (viewport.suppressClick) return;
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
	// All interaction state/behavior lives in SeatMapViewport (cooperative
	// wheel/touch rules documented there); this component only renders it.
	let svgEl = $state<SVGSVGElement>();
	const viewport = new SeatMapViewport({
		getSvg: () => svgEl,
		getContentW: () => contentW,
		getContentH: () => contentH
	});

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
			class="fill-background {category ? '' : 'stroke-border'} {seatMaxReached(pt.seatId) ||
			disabled
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
			{#if seatInteractive(pt.seatId) && view}
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
	{@const worldAngle = stage
		? worldAngleFromUp(sectorWorldCenter(sector.transform, sector.width, sector.height), stage)
		: 0}
	{@const angle = stageDirectionAngle(sector.transform, worldAngle)}
	{@const rad = (angle * Math.PI) / 180}
	{@const dirX = Math.sin(rad)}
	{@const dirY = -Math.cos(rad)}
	{@const halfW = (sector.width * CELL) / 2}
	{@const halfH = (sector.height * CELL) / 2}
	{@const cx = SCOPED_MARGIN + halfW}
	{@const cy = SCOPED_MARGIN + halfH}
	<!-- Distance from centre to the sector's bounding-box edge along the stage
	     direction, so the bar hugs the seats instead of floating a half-diagonal
	     away. -->
	{@const edge =
		1 / Math.max(Math.abs(dirX) / Math.max(halfW, 1), Math.abs(dirY) / Math.max(halfH, 1))}
	{@const BAR_THICK = 18}
	{@const gap = 9}
	{@const bx = cx + dirX * (edge + gap + BAR_THICK / 2)}
	{@const by = cy + dirY * (edge + gap + BAR_THICK / 2)}
	<!-- Bar width tracks the sector's smaller side so it reads as a stage facing
	     the seats, but stays modest so an angled bar never spills past the margin. -->
	{@const barW = Math.min(Math.max(Math.min(sector.width, sector.height) * CELL * 0.6, 60), 88)}
	<!-- Past 90° the bar's own rotation would flip the label upside-down. -->
	{@const flip = angle > 90 && angle < 270}
	<g role="img" aria-label={stageLabel}>
		<!-- Short connector tying the bar to the seat block it faces. -->
		<line
			x1={cx + dirX * edge}
			y1={cy + dirY * edge}
			x2={cx + dirX * (edge + gap)}
			y2={cy + dirY * (edge + gap)}
			class="stroke-muted-foreground/50"
			stroke-width="2"
			stroke-linecap="round"
		/>
		<!-- Bar rotated to sit perpendicular to the stage direction (the sector is
		     drawn un-rotated, so this angle conveys where the stage actually is). -->
		<g transform="translate({bx} {by}) rotate({angle})">
			<rect
				x={-barW / 2}
				y={-BAR_THICK / 2}
				width={barW}
				height={BAR_THICK}
				rx="8"
				class="fill-muted"
			/>
			<text
				text-anchor="middle"
				dominant-baseline="central"
				transform={flip ? 'rotate(180)' : undefined}
				class="fill-muted-foreground text-[11px] font-medium tracking-widest"
			>
				{stageLabel}
			</text>
		</g>
	</g>
{/snippet}

<div class="relative">
	<svg
		bind:this={svgEl}
		use:viewport.wheelZoom
		viewBox="0 0 {contentW} {contentH}"
		preserveAspectRatio="xMidYMid meet"
		class="h-full w-full select-none {viewport.captureTouch ? 'touch-none' : 'touch-pan-y'}"
		role="group"
		aria-label={m['seatMap.label']()}
		onpointerdown={viewport.onPointerDown}
		onpointermove={viewport.onPointerMove}
		onpointerup={viewport.onPointerEnd}
		onpointercancel={viewport.onPointerEnd}
		onpointerleave={viewport.onPointerEnd}
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
		<g transform="translate({viewport.tx} {viewport.ty}) scale({viewport.scale})">
			{#if onlySector}
				<!-- Scoped single-sector view: render un-rotated with the stage arrow
				     at the angle this sector faces the stage. The name sits BELOW the
				     seats — the stage indicator owns the top edge (they used to
				     collide when the stage direction was near "up"). -->
				{@render stageArrow(onlySector)}
				<text
					x={SCOPED_MARGIN + 2}
					y={SCOPED_MARGIN + onlySector.height * CELL + 16}
					class="fill-muted-foreground text-[11px] font-medium"
				>
					{onlySector.name}
				</text>
				<g transform="translate({SCOPED_MARGIN} {SCOPED_MARGIN})">
					{@render sectorBody(onlySector)}
				</g>
			{:else}
				<!-- Full map: one stage marker — at the venue's ACTUAL stage position
				     when the designer placed one, else the world-"up" fallback — and
				     each sector placed+rotated by its transform. -->
				{@const stageX = stage ? canvasX(stage.x) : contentW / 2}
				{@const stageY = stage ? canvasY(stage.y) : PAD + STAGE_H / 2}
				{#if !hideStage}
					<g role="img" aria-label={stageLabel}>
						<rect
							x={stageX - 60}
							y={stageY - STAGE_H / 2}
							width="120"
							height={STAGE_H}
							rx="8"
							class="fill-muted"
						/>
						<text
							x={stageX}
							y={stageY}
							text-anchor="middle"
							dominant-baseline="central"
							class="fill-muted-foreground text-[11px] font-medium tracking-widest"
						>
							{stageLabel}
						</text>
					</g>
				{/if}

				{#each layout.sectors as sector (sector.id)}
					{@const aabb = worldAABB(sector)}
					{@const seatSelectable = overview && seatConfigById.has(sector.id)}
					{@const target = overview && !seatSelectable ? targetsById.get(sector.id) : undefined}
					{@const ghost = overview
						? !target && !seatSelectable
						: activeSectorId != null && sector.id !== activeSectorId}
					{@const groupTransform = `translate(${canvasX(sector.transform.x)} ${canvasY(
						sector.transform.y
					)}) rotate(${sector.transform.rotation})`}
					<!-- Sector name upright in canvas space (never rotated), centered
					     above the sector's world bounding box. -->
					<text
						x={canvasX((aabb.minX + aabb.maxX) / 2)}
						y={canvasY(aabb.minY) - 6}
						text-anchor="middle"
						class="{ghost
							? 'fill-muted-foreground/60'
							: 'fill-muted-foreground'} text-[11px] font-medium"
					>
						{sector.name}
					</text>
					{#if target}
						<SeatMapSectorTarget
							{sector}
							{target}
							cell={CELL}
							seatR={SEAT_R}
							{groupTransform}
							box={{
								x: canvasX(aabb.minX),
								y: canvasY(aabb.minY),
								width: (aabb.maxX - aabb.minX) * CELL,
								height: (aabb.maxY - aabb.minY) * CELL
							}}
							onSelect={() => handleSectorSelect(sector.id)}
						/>
					{:else}
						<g transform={groupTransform}>
							{#if ghost}
								<SeatMapGhostSector
									{sector}
									cell={CELL}
									seatR={SEAT_R}
									label={overview
										? m['venueOverview.sectorNotForSale']()
										: m['seatMap.otherTicketSector']()}
								/>
							{:else}
								{@render sectorBody(sector)}
							{/if}
						</g>
					{/if}
				{/each}
			{/if}
		</g>
	</svg>

	<!-- Bare-wheel hint: the wheel scrolled the dialog (never hijacked); this
	     just teaches the zoom chord. Decorative, ignored by AT — the zoom
	     buttons below are the accessible path. -->
	{#if viewport.showWheelHint}
		<div
			aria-hidden="true"
			class="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center"
		>
			<span class="rounded-full bg-foreground/80 px-3 py-1.5 text-xs text-background shadow">
				{m['seatMap.wheelZoomHint']()}
			</span>
		</div>
	{/if}

	<!-- Zoom controls -->
	<div class="absolute right-2 top-2 flex flex-col gap-1">
		<button
			type="button"
			class={controlClass}
			aria-label={m['seatMap.zoomIn']()}
			onclick={() => viewport.zoomBy(1.25)}
		>
			<Plus class="h-4 w-4" aria-hidden="true" />
		</button>
		<button
			type="button"
			class={controlClass}
			aria-label={m['seatMap.zoomOut']()}
			onclick={() => viewport.zoomBy(0.8)}
		>
			<Minus class="h-4 w-4" aria-hidden="true" />
		</button>
		<button
			type="button"
			class={controlClass}
			aria-label={m['seatMap.zoomReset']()}
			onclick={viewport.resetView}
		>
			<RotateCcw class="h-4 w-4" aria-hidden="true" />
		</button>
	</div>
</div>
