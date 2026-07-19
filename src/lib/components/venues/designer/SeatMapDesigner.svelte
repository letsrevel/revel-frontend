<script lang="ts">
	/**
	 * Freeform seat-map designer (#659, designer part 2).
	 *
	 * One SVG canvas for the whole venue: seats are selected (click,
	 * shift-click, marquee), dragged (grid-snap toggleable) or keyboard-nudged;
	 * each sector can carry a polygon shape drawn/edited in place. Geometry
	 * derives from designer-model.ts (raw stored frames, not the public map's
	 * lossy normalization); saving builds explicit per-sector batches via
	 * designer-save.ts. Pan/zoom follows SeatMap.svelte's viewBox-fixed idiom
	 * through DesignerViewport.
	 *
	 * Keyboard path: Tab reaches the seat layer (roving tabindex), arrows move
	 * focus between seats, Enter/Space toggles selection; once the focused seat
	 * is selected, arrows nudge the whole selection (Shift = larger step) and
	 * Escape deselects. Shape vertices are individually focusable with the same
	 * arrow-nudge, Delete removes one.
	 */
	import * as m from '$lib/paraglide/messages.js';
	import type { Coordinate2d, PriceCategorySchema } from '$lib/api/generated/types.gen';
	import { Minus, Plus, RotateCcw } from '@lucide/svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import DesignerToolbar from './DesignerToolbar.svelte';
	import DesignerLegend from './DesignerLegend.svelte';
	import { buildCategoryStyleMap, resolveSeatCategory } from './designer-colors';
	import {
		idsInRect,
		nextSeatInDirection,
		nudgeDelta,
		polygonIsValid,
		rectFromCorners,
		roundCoord,
		snapPoint,
		type Direction
	} from './designer-geometry';
	import type { DesignerModel, DesignerSeat } from './designer-model';
	import {
		anyShapeChanged,
		buildSavePlan,
		countChangedSeats,
		type DesignerSavePlan
	} from './designer-save';
	import { DesignerViewport } from './designer-viewport.svelte';

	interface Props {
		model: DesignerModel;
		priceCategories?: PriceCategorySchema[];
		isSaving: boolean;
		/** Persist the plan; resolve true when everything was written. */
		onSave: (plan: DesignerSavePlan) => Promise<boolean>;
		onDirtyChange?: (dirty: boolean) => void;
		/** Link target for a sector's grid editor. */
		sectorEditorHref: (sectorId: string) => string;
	}

	const {
		model,
		priceCategories = [],
		isSaving,
		onSave,
		onDirtyChange,
		sectorEditorHref
	}: Props = $props();

	const uid = $props.id();

	// Pixels per layout unit and canvas chrome (same values as SeatMap.svelte).
	const CELL = 32;
	const SEAT_R = 11;
	const PAD = 16;
	const STAGE_H = 24;
	const OFFSET_Y = PAD + STAGE_H + 12 + 16;

	// --- editable state (initialized once from the frozen model) --------------
	const seatPos = new SvelteMap<string, Coordinate2d>(
		model.seats.map((seat) => [seat.id, { x: seat.x, y: seat.y }])
	);
	const baselinePos = new SvelteMap<string, Coordinate2d>(
		model.seats.map((seat) => [seat.id, { x: seat.x, y: seat.y }])
	);
	const shapes = new SvelteMap<string, Coordinate2d[] | null>(
		model.sectors.map((sector) => [sector.id, sector.shape?.map((p) => ({ ...p })) ?? null])
	);
	const baselineShapes = new SvelteMap<string, Coordinate2d[] | null>(
		model.sectors.map((sector) => [sector.id, sector.shape?.map((p) => ({ ...p })) ?? null])
	);

	const selection = new SvelteSet<string>();
	let tool = $state<'select' | 'pan'>('select');
	let snapOn = $state(true);
	let activeSectorId = $state<string | null>(model.sectors[0]?.id ?? null);
	let shapeMode = $state(false);
	let selectedVertex = $state<number | null>(null);
	let focusSeatId = $state<string | null>(null);
	let marqueeRect = $state<{ a: Coordinate2d; b: Coordinate2d } | null>(null);
	let saveIssues = $state<DesignerSavePlan | null>(null);

	// --- derived --------------------------------------------------------------
	// id → {color, name} for painted seats; drives fill accent + a11y suffix.
	const categoryStyles = $derived(buildCategoryStyleMap(priceCategories));
	const changedCount = $derived(countChangedSeats(model, seatPos, baselinePos));
	const shapesDirty = $derived(anyShapeChanged(model.sectors, shapes, baselineShapes));
	const dirty = $derived(changedCount > 0 || shapesDirty);
	$effect(() => {
		onDirtyChange?.(dirty);
	});

	const seatCenters = $derived(
		model.seats.map((seat) => {
			const p = seatPos.get(seat.id) ?? seat;
			return { id: seat.id, x: p.x + 0.5, y: p.y + 0.5 };
		})
	);

	const bounds = $derived.by(() => {
		let maxX = model.width;
		let maxY = model.height;
		for (const p of seatPos.values()) {
			maxX = Math.max(maxX, p.x + 1);
			maxY = Math.max(maxY, p.y + 1);
		}
		for (const shape of shapes.values()) {
			for (const p of shape ?? []) {
				maxX = Math.max(maxX, p.x);
				maxY = Math.max(maxY, p.y);
			}
		}
		return { maxX, maxY };
	});
	const contentW = $derived(Math.max(bounds.maxX * CELL + PAD * 2, 240));
	const contentH = $derived(OFFSET_Y + bounds.maxY * CELL + PAD);

	const activeSector = $derived(model.sectors.find((s) => s.id === activeSectorId) ?? null);
	const activeShape = $derived(activeSectorId ? (shapes.get(activeSectorId) ?? null) : null);
	const activeShapeInvalid = $derived(
		shapeMode && activeShape !== null && !polygonIsValid(activeShape)
	);

	const activeFocusId = $derived(
		focusSeatId && seatPos.has(focusSeatId) ? focusSeatId : (model.seats[0]?.id ?? null)
	);

	const vp = new DesignerViewport({ pad: PAD, offsetY: OFFSET_Y, cell: CELL }, () => ({
		w: contentW,
		h: contentH
	}));

	// px helpers (unit space → viewBox space, pre-transform).
	const px = (ux: number) => PAD + ux * CELL;
	const py = (uy: number) => OFFSET_Y + uy * CELL;

	// --- pointer interactions -------------------------------------------------
	type DragState =
		| { kind: 'pan'; pointerId: number }
		| { kind: 'marquee'; pointerId: number; additive: boolean }
		| {
				kind: 'seats';
				pointerId: number;
				startUnit: Coordinate2d;
				starts: Map<string, Coordinate2d>;
				anchorId: string;
		  }
		| { kind: 'vertex'; pointerId: number; index: number }
		| { kind: 'vertex-add'; pointerId: number; startClient: Coordinate2d };

	let drag: DragState | null = null;
	const pointers = new SvelteMap<number, Coordinate2d>();

	function snappedUnit(unit: Coordinate2d): Coordinate2d {
		return snapOn ? snapPoint(unit) : { x: roundCoord(unit.x), y: roundCoord(unit.y) };
	}

	function onSeatPointerDown(event: PointerEvent, seat: DesignerSeat) {
		if (tool === 'pan' || shapeMode) return; // bubble to the canvas handler
		event.stopPropagation();
		pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		focusSeatId = seat.id;
		if (event.shiftKey) {
			if (selection.has(seat.id)) {
				selection.delete(seat.id);
				return;
			}
			selection.add(seat.id);
		} else if (!selection.has(seat.id)) {
			selection.clear();
			selection.add(seat.id);
		}
		const startUnit = vp.clientToUnit(event.clientX, event.clientY);
		if (!startUnit) return;
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- not reactive state: drag-start snapshot consumed synchronously during the drag
		const starts = new Map<string, Coordinate2d>();
		for (const id of selection) {
			const p = seatPos.get(id);
			if (p) starts.set(id, { ...p });
		}
		drag = { kind: 'seats', pointerId: event.pointerId, startUnit, starts, anchorId: seat.id };
		vp.svgEl?.setPointerCapture(event.pointerId);
	}

	function onVertexPointerDown(event: PointerEvent, index: number) {
		if (tool === 'pan') return;
		event.stopPropagation();
		pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		selectedVertex = index;
		drag = { kind: 'vertex', pointerId: event.pointerId, index };
		vp.svgEl?.setPointerCapture(event.pointerId);
	}

	function onCanvasPointerDown(event: PointerEvent) {
		pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		if (pointers.size >= 2) {
			drag = null;
			marqueeRect = null;
			return;
		}
		if (tool === 'pan') {
			drag = { kind: 'pan', pointerId: event.pointerId };
		} else if (shapeMode) {
			drag = {
				kind: 'vertex-add',
				pointerId: event.pointerId,
				startClient: { x: event.clientX, y: event.clientY }
			};
		} else {
			const unit = vp.clientToUnit(event.clientX, event.clientY);
			if (!unit) return;
			drag = { kind: 'marquee', pointerId: event.pointerId, additive: event.shiftKey };
			marqueeRect = { a: unit, b: unit };
		}
		vp.svgEl?.setPointerCapture(event.pointerId);
	}

	function onCanvasPointerMove(event: PointerEvent) {
		const prev = pointers.get(event.pointerId);
		if (!prev) return;
		const current = { x: event.clientX, y: event.clientY };
		if (pointers.size === 2) {
			const other = [...pointers.entries()].find(([id]) => id !== event.pointerId)?.[1];
			if (other) {
				const prevDist = Math.hypot(prev.x - other.x, prev.y - other.y);
				const nextDist = Math.hypot(current.x - other.x, current.y - other.y);
				if (prevDist > 0) {
					const mid = vp.clientToView((current.x + other.x) / 2, (current.y + other.y) / 2);
					if (mid) vp.zoomAt(mid.x, mid.y, nextDist / prevDist);
				}
			}
			pointers.set(event.pointerId, current);
			return;
		}
		if (drag && drag.pointerId === event.pointerId) {
			if (drag.kind === 'pan') {
				vp.panByClientDelta(current.x - prev.x, current.y - prev.y);
			} else if (drag.kind === 'seats') {
				const unit = vp.clientToUnit(current.x, current.y);
				const anchorStart = drag.starts.get(drag.anchorId);
				if (unit && anchorStart) {
					const target = {
						x: anchorStart.x + unit.x - drag.startUnit.x,
						y: anchorStart.y + unit.y - drag.startUnit.y
					};
					const snapped = snappedUnit(target);
					const dx = snapped.x - anchorStart.x;
					const dy = snapped.y - anchorStart.y;
					for (const [id, start] of drag.starts) {
						seatPos.set(id, { x: roundCoord(start.x + dx), y: roundCoord(start.y + dy) });
					}
				}
			} else if (drag.kind === 'marquee' && marqueeRect) {
				const unit = vp.clientToUnit(current.x, current.y);
				if (unit) marqueeRect = { a: marqueeRect.a, b: unit };
			} else if (drag.kind === 'vertex' && activeSectorId) {
				const unit = vp.clientToUnit(current.x, current.y);
				if (unit) {
					const points = [...(shapes.get(activeSectorId) ?? [])];
					if (drag.index < points.length) {
						points[drag.index] = snappedUnit(unit);
						shapes.set(activeSectorId, points);
					}
				}
			} else if (drag.kind === 'vertex-add') {
				const moved =
					Math.abs(current.x - drag.startClient.x) + Math.abs(current.y - drag.startClient.y) > 4;
				if (moved) drag = { kind: 'pan', pointerId: drag.pointerId };
			}
		}
		pointers.set(event.pointerId, current);
	}

	function onCanvasPointerEnd(event: PointerEvent) {
		pointers.delete(event.pointerId);
		if (!drag || drag.pointerId !== event.pointerId) return;
		if (drag.kind === 'marquee' && marqueeRect) {
			const rect = rectFromCorners(marqueeRect.a, marqueeRect.b);
			const ids = idsInRect(seatCenters, rect);
			if (!drag.additive) selection.clear();
			for (const id of ids) selection.add(id);
		} else if (drag.kind === 'vertex-add') {
			addVertexAt(vp.clientToUnit(event.clientX, event.clientY));
		}
		drag = null;
		marqueeRect = null;
	}

	function addVertexAt(unit: Coordinate2d | null) {
		if (!unit || !activeSectorId) return;
		const points = [...(shapes.get(activeSectorId) ?? []), snappedUnit(unit)];
		shapes.set(activeSectorId, points);
		selectedVertex = points.length - 1;
	}

	// --- keyboard -------------------------------------------------------------
	const KEY_DIRECTIONS: Record<string, Direction> = {
		ArrowLeft: 'left',
		ArrowRight: 'right',
		ArrowUp: 'up',
		ArrowDown: 'down'
	};

	function focusSeatElement(seatId: string) {
		const el = vp.svgEl?.querySelector(`[data-seat-id="${CSS.escape(seatId)}"]`);
		(el as { focus?: () => void } | null)?.focus?.();
	}

	function onSeatKeydown(event: KeyboardEvent, seat: DesignerSeat) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			focusSeatId = seat.id;
			if (selection.has(seat.id)) {
				selection.delete(seat.id);
			} else {
				selection.add(seat.id);
			}
			return;
		}
		if (event.key === 'Escape') {
			selection.clear();
			return;
		}
		const direction = KEY_DIRECTIONS[event.key];
		if (!direction) return;
		event.preventDefault();
		if (selection.has(seat.id)) {
			const delta = nudgeDelta(direction, snapOn, event.shiftKey);
			for (const id of selection) {
				const p = seatPos.get(id);
				if (p) seatPos.set(id, { x: roundCoord(p.x + delta.x), y: roundCoord(p.y + delta.y) });
			}
		} else {
			const nextId = nextSeatInDirection(seatCenters, seat.id, direction);
			if (nextId) {
				focusSeatId = nextId;
				focusSeatElement(nextId);
			}
		}
	}

	function onVertexKeydown(event: KeyboardEvent, index: number) {
		if (!activeSectorId) return;
		if (event.key === 'Delete' || event.key === 'Backspace') {
			event.preventDefault();
			removeVertex(index);
			return;
		}
		if (event.key === 'Escape') {
			exitShapeMode();
			return;
		}
		const direction = KEY_DIRECTIONS[event.key];
		if (!direction) return;
		event.preventDefault();
		const delta = nudgeDelta(direction, snapOn, event.shiftKey);
		const points = [...(shapes.get(activeSectorId) ?? [])];
		if (index >= points.length) return;
		points[index] = {
			x: roundCoord(points[index].x + delta.x),
			y: roundCoord(points[index].y + delta.y)
		};
		shapes.set(activeSectorId, points);
	}

	function removeVertex(index: number) {
		if (!activeSectorId) return;
		const points = [...(shapes.get(activeSectorId) ?? [])];
		points.splice(index, 1);
		shapes.set(activeSectorId, points.length > 0 ? points : null);
		selectedVertex = null;
	}

	// --- shape mode -----------------------------------------------------------
	function enterShapeMode() {
		if (!activeSectorId) return;
		shapeMode = true;
		selectedVertex = null;
		selection.clear();
	}

	function exitShapeMode() {
		shapeMode = false;
		selectedVertex = null;
	}

	function clearShape() {
		if (!activeSectorId) return;
		shapes.set(activeSectorId, null);
		selectedVertex = null;
	}

	// --- save -----------------------------------------------------------------
	async function handleSave() {
		const plan = buildSavePlan({
			model,
			positions: seatPos,
			baselinePositions: baselinePos,
			shapes,
			baselineShapes
		});
		if (plan.violations.length > 0 || plan.invalidShapeSectors.length > 0) {
			saveIssues = plan;
			return;
		}
		saveIssues = null;
		if (plan.isEmpty) return;
		const ok = await onSave(plan);
		if (ok) {
			for (const [id, p] of seatPos) baselinePos.set(id, { ...p });
			for (const [id, shape] of shapes) {
				baselineShapes.set(id, shape ? shape.map((point) => ({ ...point })) : null);
			}
		}
	}

	// --- labels ---------------------------------------------------------------
	function seatLabel(seat: DesignerSeat): string {
		let label = `${m['seatSelector.seat']()} ${seat.label}`;
		const sector = model.sectors.find((s) => s.id === seat.sectorId);
		if (sector) label += `, ${sector.name}`;
		if (seat.isAccessible) label += `, ${m['seatSelector.accessible']()}`;
		if (seat.isObstructedView) {
			label += `, ${m['seatSelector.obstructedView']()}`;
		}
		// Category color is never the only signal: pair it with the name.
		const category = resolveSeatCategory(seat.priceCategoryId, categoryStyles);
		if (category) label += `, ${category.name}`;
		return label;
	}

	function vertexLabel(index: number): string {
		const name = activeSector?.name ?? '';
		return m['seatDesigner.vertexLabel']({ index: index + 1, sector: name });
	}

	const zoomButtonClass =
		'flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background/90 ' +
		'text-foreground shadow-sm transition-colors hover:bg-muted ' +
		'[@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11';
</script>

<div class="space-y-4">
	<DesignerToolbar
		sectors={model.sectors}
		{tool}
		{snapOn}
		{activeSectorId}
		{shapeMode}
		hasShape={activeShape !== null}
		shapeInvalid={activeShapeInvalid}
		selectionCount={selection.size}
		{dirty}
		{isSaving}
		{sectorEditorHref}
		onToolChange={(next) => (tool = next)}
		onSnapToggle={() => (snapOn = !snapOn)}
		onSectorChange={(sectorId) => {
			activeSectorId = sectorId;
			exitShapeMode();
		}}
		onEnterShapeMode={enterShapeMode}
		onExitShapeMode={exitShapeMode}
		onClearShape={clearShape}
		onClearSelection={() => selection.clear()}
		onSave={handleSave}
	/>

	<!-- Instructions -->
	<p id="{uid}-instructions" class="text-sm text-muted-foreground">
		{#if shapeMode}
			{m['seatDesigner.shapeInstructions']()}
		{:else}
			{m['seatDesigner.instructions']()}
		{/if}
	</p>

	{#if activeShapeInvalid}
		<p class="text-sm font-medium text-destructive" role="alert">
			{m['seatDesigner.shapeTooFewPoints']()}
		</p>
	{/if}

	<!-- Blocked-save issues -->
	{#if saveIssues && (saveIssues.violations.length > 0 || saveIssues.invalidShapeSectors.length > 0)}
		<div class="rounded-md bg-destructive/10 p-4 text-sm text-destructive" role="alert">
			{#each saveIssues.invalidShapeSectors as sector (sector.sectorId)}
				<p>
					{sector.sectorName}: {m['seatDesigner.shapeTooFewPoints']()}
				</p>
			{/each}
			{#each saveIssues.violations as violation (violation.sectorId)}
				<p>
					{m['seatDesigner.seatsOutsideShape']({ sector: violation.sectorName })}
					{violation.seatLabels.join(', ')}
				</p>
			{/each}
		</div>
	{/if}

	<!-- Canvas -->
	<div class="relative overflow-hidden rounded-lg border bg-card">
		<svg
			bind:this={vp.svgEl}
			use:vp.wheel
			viewBox="0 0 {contentW} {contentH}"
			class="h-auto w-full touch-none select-none {tool === 'pan' ? 'cursor-grab' : ''}"
			role="application"
			aria-label={m['seatDesigner.canvasLabel']()}
			aria-describedby="{uid}-instructions"
			onpointerdown={onCanvasPointerDown}
			onpointermove={onCanvasPointerMove}
			onpointerup={onCanvasPointerEnd}
			onpointercancel={onCanvasPointerEnd}
		>
			<g transform="translate({vp.tx} {vp.ty}) scale({vp.scale})">
				<!-- Stage marker -->
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
					{m['seatSelector.stage']()}
				</text>

				{#each model.sectors as sector (sector.id)}
					{@const shape = shapes.get(sector.id) ?? null}
					{@const isActive = sector.id === activeSectorId}
					<g>
						<text
							x={px(sector.origin.x) + 2}
							y={py(sector.origin.y) - 6}
							class="text-[11px] font-medium {isActive ? 'fill-primary' : 'fill-muted-foreground'}"
						>
							{sector.name}
						</text>
						{#if shape && shape.length >= 3}
							<polygon
								points={shape.map((p) => `${px(p.x)},${py(p.y)}`).join(' ')}
								class="fill-muted/30 {isActive ? 'stroke-primary/70' : 'stroke-border/60'}"
								stroke-width={isActive ? 1.5 : 1}
							/>
						{:else}
							{#if shape && shape.length > 0}
								<polyline
									points={shape.map((p) => `${px(p.x)},${py(p.y)}`).join(' ')}
									class="fill-none stroke-primary/60"
									stroke-width="1.5"
									stroke-dasharray="4 3"
								/>
							{/if}
							<rect
								x={px(sector.origin.x) - 6}
								y={py(sector.origin.y) - 6}
								width={sector.width * CELL + 12}
								height={sector.height * CELL + 12}
								rx="10"
								class="fill-muted/20 {isActive ? 'stroke-primary/50' : 'stroke-border/50'}"
								stroke-dasharray={sector.hasSeats ? undefined : '6 4'}
								stroke-width="1"
							/>
							{#if !sector.hasSeats}
								<text
									x={px(sector.origin.x + sector.width / 2)}
									y={py(sector.origin.y + sector.height / 2)}
									text-anchor="middle"
									dominant-baseline="central"
									class="fill-muted-foreground text-[11px]"
								>
									{m['seatDesigner.noSeats']()}
								</text>
							{/if}
						{/if}
					</g>
				{/each}

				<!-- Seats (colored by painted price category; selection = halo on top) -->
				{#each model.seats as seat (seat.id)}
					{@const p = seatPos.get(seat.id) ?? seat}
					{@const cx = px(p.x + 0.5)}
					{@const cy = py(p.y + 0.5)}
					{@const selected = selection.has(seat.id)}
					{@const category = resolveSeatCategory(seat.priceCategoryId, categoryStyles)}
					<g
						data-seat-id={seat.id}
						role="button"
						tabindex={seat.id === activeFocusId ? 0 : -1}
						aria-label={seatLabel(seat)}
						aria-pressed={selected}
						class="outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring {tool ===
							'select' && !shapeMode
							? 'cursor-move'
							: ''}"
						onpointerdown={(event) => onSeatPointerDown(event, seat)}
						onkeydown={(event) => onSeatKeydown(event, seat)}
					>
						<title>{seatLabel(seat)}</title>
						<!-- Selection halo: theme-token ring outlined by the surface, so it
						     stays unambiguous over ANY category color. Drawn behind the seat. -->
						{#if selected}
							<circle
								{cx}
								{cy}
								r={SEAT_R + 4}
								class="fill-none stroke-background"
								stroke-width="4"
							/>
							<circle {cx} {cy} r={SEAT_R + 4} class="fill-none stroke-primary" stroke-width="2" />
						{/if}
						{#if category}
							<circle
								{cx}
								{cy}
								r={SEAT_R}
								fill={category.color}
								fill-opacity="0.22"
								stroke={category.color}
								stroke-width="2.5"
							/>
						{:else}
							<circle {cx} {cy} r={SEAT_R} class="fill-background stroke-border" stroke-width="2" />
						{/if}
						<text
							x={cx}
							y={cy}
							text-anchor="middle"
							dominant-baseline="central"
							class="pointer-events-none text-[8px] fill-muted-foreground"
						>
							{seat.label}
						</text>
					</g>
				{/each}

				<!-- Shape vertices (active sector, shape mode) -->
				{#if shapeMode && activeShape}
					{#each activeShape as vertex, index (index)}
						<circle
							data-vertex-index={index}
							role="button"
							tabindex="0"
							aria-label={vertexLabel(index)}
							cx={px(vertex.x)}
							cy={py(vertex.y)}
							r="6"
							class="cursor-move {index === selectedVertex
								? 'fill-primary stroke-primary-foreground'
								: 'fill-background stroke-primary'} outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
							stroke-width="2"
							onpointerdown={(event) => onVertexPointerDown(event, index)}
							onkeydown={(event) => onVertexKeydown(event, index)}
						/>
					{/each}
				{/if}

				<!-- Marquee -->
				{#if marqueeRect}
					{@const rect = rectFromCorners(marqueeRect.a, marqueeRect.b)}
					<rect
						x={px(rect.minX)}
						y={py(rect.minY)}
						width={(rect.maxX - rect.minX) * CELL}
						height={(rect.maxY - rect.minY) * CELL}
						class="fill-primary/10 stroke-primary/60"
						stroke-width="1"
						stroke-dasharray="4 3"
					/>
				{/if}
			</g>
		</svg>

		<!-- Zoom controls -->
		<div class="absolute right-2 top-2 flex flex-col gap-1">
			<button
				type="button"
				class={zoomButtonClass}
				aria-label={m['seatMap.zoomIn']()}
				onclick={() => vp.zoomBy(1.25)}
			>
				<Plus class="h-4 w-4" aria-hidden="true" />
			</button>
			<button
				type="button"
				class={zoomButtonClass}
				aria-label={m['seatMap.zoomOut']()}
				onclick={() => vp.zoomBy(0.8)}
			>
				<Minus class="h-4 w-4" aria-hidden="true" />
			</button>
			<button
				type="button"
				class={zoomButtonClass}
				aria-label={m['seatMap.zoomReset']()}
				onclick={() => vp.reset()}
			>
				<RotateCcw class="h-4 w-4" aria-hidden="true" />
			</button>
		</div>
	</div>

	<!-- Price-category legend (painting lives in the grid editor) -->
	<DesignerLegend categories={priceCategories} />
</div>
