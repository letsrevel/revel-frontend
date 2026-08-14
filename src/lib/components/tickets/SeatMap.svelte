<script lang="ts">
	/**
	 * SVG seat map (#659, v1 core — pure rendering, no dialog integration).
	 *
	 * Geometry comes from seat-map-layout.ts (unit space, scaled to pixels
	 * here); seat statuses come from the `seats` prop built via
	 * seating-view.buildSeatViews (source of truth).
	 *
	 * VISUAL LANGUAGE (#852): this is the landing page's SeatMapMock made real,
	 * and the sector editor draws the identical room — solid round dots on a
	 * mode-inert poster-ink panel, the mock's stage pill, a white offset ring
	 * for the seats you hold. `seat-map-paint.ts` owns the fill/glyph rules and
	 * documents the measured contrast; the panel is deliberately the same in
	 * light and dark (imagery rule) while everything AROUND it stays on theme
	 * tokens.
	 *
	 * Status is never carried by colour alone: `mine` gets a check glyph and a
	 * ring, `pending` pulses and sets aria-busy, unavailable seats dim to
	 * white@25 with the reason ("sold" / "held" / "blocked") in their
	 * accessible name and hover title, and a price-category colour always
	 * pairs with the category name in that same name.
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
	import SeatMapStageArrow from './SeatMapStageArrow.svelte';
	import SeatMapStagePill from './SeatMapStagePill.svelte';
	import { homeViewFor, SeatMapViewport } from './seat-map-viewport.svelte';
	import {
		computeSeatMapLayout,
		worldBounds,
		type SeatPoint,
		type SectorLayout
	} from './seat-map-layout';
	import { rowsFromSeatViews, seatAriaLabel, type SeatView } from './seating-view';
	import { buildSeatRotationLookup, notchSegment } from './seat-rotation';
	import { seatFill, seatGlyphColor } from './seat-map-paint';

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
		/**
		 * Browse-everything contexts (the venue overview dialog): the home view
		 * always fits the whole venue in frame, never zooming to a focus sector.
		 * Without this, a venue with one seat-selectable sector homes zoomed onto
		 * it and the remaining sector targets render clipped out of frame.
		 */
		fitAllHome?: boolean;
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
		interactiveSectors = null,
		fitAllHome = false
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

	/**
	 * Seat id -> rotation degrees, from each sector's `metadata.seatRotations`
	 * mirror (BE #894 whitelists it for the public chart). Defensive by
	 * construction: an absent or malformed key yields an empty lookup and every
	 * seat renders plain, so this never depends on backend deploy order.
	 */
	const seatRotation = $derived(buildSeatRotationLookup(chart.sectors));

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

	// Rendered CSS box of the map (the wrapper is h-full, so this is the
	// host's fixed-height frame) — needed to decide whether fit-all keeps
	// seats readable (homeViewFor).
	let boxW = $state(0);
	let boxH = $state(0);

	/** Canvas-space centre of the sector the buyer is here to buy — the focus
	    when the home view must zoom past fit-all. activeSectorId marks it in
	    plain venue scope; in overview mode it's the seat-selectable sector. */
	const focusCenter = $derived.by(() => {
		if (fitAllHome) return null;
		const focusId = activeSectorId ?? interactiveSectors?.[0]?.sectorId ?? null;
		if (!focusId || onlySector) return null;
		const sector = layout.sectors.find((candidate) => candidate.id === focusId);
		if (!sector) return null;
		const aabb = worldBounds(sector);
		return {
			x: canvasX((aabb.minX + aabb.maxX) / 2),
			y: canvasY((aabb.minY + aabb.maxY) / 2)
		};
	});

	// Keep the home view current (it's also the Reset target), but only SNAP
	// the live view to it when the content itself changes — first measure, or
	// a scope/floor switch swapping the chart — never on a mere resize, which
	// must not steal the user's pan/zoom.
	let contentKey = '';
	$effect(() => {
		const key = `${contentW}x${contentH}`;
		viewport.setHome(
			homeViewFor({ boxW, boxH, contentW, contentH, cell: CELL, focus: focusCenter })
		);
		if (boxW === 0 || boxH === 0) return;
		if (key !== contentKey) {
			contentKey = key;
			viewport.resetView();
		}
	});

	// --- standing zones -----------------------------------------------------
	const standingLabelText = m['seatMap.standing']();

	function standingCountText(sectorId: string): string | null {
		const counts = standingCounts?.[sectorId];
		if (!counts) return null;
		return `${Math.max(counts.capacity - counts.taken, 0)}/${counts.capacity}`;
	}

	/**
	 * Zoom chrome ON the ink panel. `--ring` is a purple halo on a poster panel
	 * (1.27:1 light / 2.07:1 dark — see app.css), so these declare their own
	 * poster focus treatment: amber on ink is 9.42:1. The white@10 button face
	 * composites to 1.33:1 against the panel, and full white on it is 13.08:1
	 * (that pair, and the wheel hint's white@15, are rows in COMPOSITED_PAIRS).
	 */
	const controlClass =
		'flex h-9 w-9 items-center justify-center rounded-full border border-poster-white/20 ' +
		'bg-poster-white/10 text-poster-white transition-colors hover:bg-poster-white/20 ' +
		'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ' +
		'focus-visible:outline-poster-amber [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11';
</script>

{#snippet seatShape(pt: SeatPoint, view: SeatView | undefined, cx: number, cy: number)}
	{@const status = view?.status ?? 'blocked'}
	{@const category = categoryFor(pt.seatId)}
	{@const fill = seatFill(category?.color)}
	{@const glyph = seatGlyphColor(category?.color)}
	{@const live = status === 'mine' || status === 'available'}
	{@const rot = seatRotation.get(pt.seatId) ?? 0}
	<title>{seatLabelFor(pt, view)}</title>
	{#if status === 'mine'}
		<!-- Held by me: the mock's white offset ring (an `outline-offset-2
		     outline-2` in SVG terms) around the seat's own colour, plus the check.
		     White on ink is 17.40:1, and the glyph rides paintTextColor so it stays
		     readable on any category colour the organizer picked. -->
		<circle {cx} {cy} r={SEAT_R + 3} fill="none" class="stroke-poster-white" stroke-width="2" />
		<circle {cx} {cy} r={SEAT_R} {fill} />
		<path
			d="M {cx - 4.5} {cy + 0.5} l 3 3 l 6 -7"
			stroke={glyph}
			stroke-width="2"
			fill="none"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	{:else if status === 'pending'}
		<!-- In-flight hold: white@40 (3.79:1 on ink) and pulsing, with aria-busy
		     on the seat group — brighter than the @25 dim so a seat being taken
		     never reads as one already gone. -->
		<circle {cx} {cy} r={SEAT_R} class="animate-pulse fill-poster-white/40" />
	{:else if status === 'available'}
		<circle
			{cx}
			{cy}
			r={SEAT_R}
			{fill}
			class={seatMaxReached(pt.seatId) || disabled ? 'opacity-50' : ''}
		/>
	{:else}
		<!-- sold / held / blocked: the mock's dim seat. Not an X, not a pattern —
		     availability reads as LIGHTNESS (solid vs white@25, 3.70:1 apart), which
		     survives every colour-vision deficiency; the reason stays in the
		     accessible name and the <title> above. -->
		<circle {cx} {cy} r={SEAT_R} class="fill-poster-white/25" />
	{/if}
	{#if rot !== 0}
		<!-- Seat-back orientation notch — same geometry the sector editor draws
		     (seat-rotation.ts owns the contract: degrees clockwise from "up",
		     sector-local, so the sector's own group rotation carries it along).
		     On a solid seat it takes that seat's own glyph colour; on the faint
		     dim/pending fills ink would vanish, so it goes white@80. -->
		{@const notch = notchSegment(rot, SEAT_R)}
		<line
			x1={cx + notch.x1}
			y1={cy + notch.y1}
			x2={cx + notch.x2}
			y2={cy + notch.y2}
			stroke={live ? glyph : 'hsl(var(--poster-white) / 0.8)'}
			stroke-width={notch.width}
			stroke-linecap="round"
			data-testid="seat-rotation-notch"
			data-rot={rot}
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
				class="fill-poster-white/[0.06] stroke-poster-white/30"
				stroke-dasharray="6 4"
				stroke-width="1.5"
			/>
			<text
				x={(sector.width * CELL) / 2}
				y={(sector.height * CELL) / 2}
				text-anchor="middle"
				dominant-baseline="central"
				class="fill-poster-white/80 text-[11px]"
			>
				{counts ? `${standingLabelText} · ${counts}` : standingLabelText}
			</text>
		</g>
	{:else}
		<!-- Sector footprint: a barely-there wash on the ink house, so the seats
		     stay the loudest thing in frame (white@4 fill / white@12 edge). -->
		{#if sector.shape}
			<polygon
				points={sector.shape.map((p) => `${p.x * CELL},${p.y * CELL}`).join(' ')}
				class="fill-poster-white/[0.05] stroke-poster-white/[0.12]"
				stroke-width="1"
			/>
		{:else}
			<rect
				x={-6}
				y={-6}
				width={sector.width * CELL + 12}
				height={sector.height * CELL + 12}
				rx="10"
				class="fill-poster-white/[0.04] stroke-poster-white/[0.12]"
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
						: 'cursor-not-allowed'} outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-poster-amber"
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

<!-- h-full: the svg must FILL the host's fixed-height frame so the viewBox
     letterboxes into it (`meet`) — without it the svg takes its intrinsic
     aspect-ratio height and the frame's overflow-hidden clips the chart.

     The panel is the landing mock's house: poster ink, 20px radius, IDENTICAL
     in light and dark (imagery rule — it is a picture of a room, not a
     surface). Hosts supply the frame's height and clipping only; every piece of
     chrome that lands on it below carries its own poster-palette treatment. -->
<div
	class="relative h-full rounded-[20px] bg-poster-ink"
	bind:clientWidth={boxW}
	bind:clientHeight={boxH}
>
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
		<g transform="translate({viewport.tx} {viewport.ty}) scale({viewport.scale})">
			{#if onlySector}
				<!-- Scoped single-sector view: render un-rotated with the stage arrow
				     at the angle this sector faces the stage. The name sits BELOW the
				     seats — the stage indicator owns the top edge (they used to
				     collide when the stage direction was near "up"). -->
				<SeatMapStageArrow
					sector={onlySector}
					{stage}
					label={stageLabel}
					cell={CELL}
					margin={SCOPED_MARGIN}
				/>
				<text
					x={SCOPED_MARGIN + 2}
					y={SCOPED_MARGIN + onlySector.height * CELL + 16}
					class="fill-poster-white/80 text-[11px] font-medium"
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
					<g role="img" aria-label={stageLabel} transform="translate({stageX} {stageY})">
						<SeatMapStagePill label={stageLabel} width={120} height={STAGE_H} />
					</g>
				{/if}

				{#each layout.sectors as sector (sector.id)}
					{@const aabb = worldBounds(sector)}
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
							? 'fill-poster-white/50'
							: 'fill-poster-white/80'} text-[11px] font-medium"
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
			<span class="rounded-full bg-poster-white/15 px-3 py-1.5 text-xs text-poster-white">
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
