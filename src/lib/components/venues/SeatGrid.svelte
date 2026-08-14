<script lang="ts">
	/**
	 * WYSIWYG sector grid: ONE editing surface that draws every cell at its
	 * BAKED position (seat-layout-bake.ts) — the exact coordinates the buyer's
	 * seat map renders at checkout. There is no separate straight lattice and
	 * no separate curved preview any more; bending a row in SeatGeometryPanel
	 * bends this grid.
	 *
	 * Editing stays LOGICAL: clicks, drag-fill rectangles, painting and
	 * selection are all addressed by (row, column) indices, so a curved,
	 * staggered or aisle-split room fills exactly like a plain one. Only the
	 * pixel placement is geometric.
	 *
	 * The rails stay STRAIGHT: row labels track their row's baked y, column
	 * labels keep their aisle-shifted x (index hints — under curvature only the
	 * row endpoints line up under them, which is fine), and the aisle add/remove
	 * hover zones live on the rails exactly as before.
	 *
	 * VISUAL LANGUAGE (#852): this canvas is the same room the buyer sees —
	 * the landing mock's poster-ink house, solid round seat dots in their
	 * price-category colour (poster Periwinkle when unpainted), empty slots as
	 * ghost outlines, selection as a white offset ring, and the mock's stage
	 * pill. The panel is mode-inert (imagery rule); the rails and their aisle
	 * affordances sit ON it in white@80, so the whole editing surface is one
	 * picture instead of a card with a picture in it. `seat-grid-cell-class.ts`
	 * owns the per-cell classes (and the measured contrast), `seat-map-paint.ts`
	 * the fill/label colours the buyer's map uses for the very same seats.
	 */
	import * as m from '$lib/paraglide/messages.js';
	import { Plus, Accessibility, EyeOff } from '@lucide/svelte';
	import type { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import type { Coordinate2d, PriceCategorySchema } from '$lib/api/generated/types.gen';
	import type { SeatData } from './seat-grid-types';
	import { seatFill, seatGlyphColor } from '$lib/components/tickets/seat-map-paint';
	import { seatCellClass } from './seat-grid-cell-class';
	import { applyRectangle, SeatRectSelector } from './seat-grid-rect.svelte';
	import SeatRotationNotch from './SeatRotationNotch.svelte';
	import { aisleShift } from './seat-layout-bake';
	import {
		ARROW_NUDGE,
		NUDGE_COARSE_STEP,
		NUDGE_STEP,
		SeatDragController,
		nextColumnInRow,
		populatedRowsOf,
		type SeatAdjustState
	} from './seat-adjust-state.svelte';
	import {
		AISLE_ZONE_PX,
		BUTTON_PX,
		CELL_PX,
		COL_RAIL_PX,
		RAIL_PX,
		canvasFrame,
		cellButtonStyle,
		centerPx,
		edgePx,
		gapBand,
		gapCenter,
		markerStyle,
		round,
		rowEndAnchor,
		worldPointFromClick
	} from './seat-grid-layout';

	interface Props {
		seats: SvelteMap<string, SeatData>;
		selectedCells: SvelteSet<string>;
		verticalAisles: SvelteSet<number>;
		horizontalAisles: SvelteSet<number>;
		rows: number;
		columns: number;
		invertRowOrder: boolean;
		getRowLabel: (index: number) => string;
		getSeatLabel: (rowIndex: number, colIndex: number) => string;
		getCellKey: (row: number, col: number) => string;
		/**
		 * Baked position of EVERY drawn cell — real seats from the save bake,
		 * empty click targets from the synthetic all-exist lattice
		 * (SeatGeometryState.display).
		 */
		positions: ReadonlyMap<string, Coordinate2d>;
		/** The sector's persisted outline, drawn as an underlay. */
		shape?: Coordinate2d[] | null;
		/** The auto-fit candidate, drawn dashed while the shape dialog is open. */
		proposedShape?: Coordinate2d[] | null;
		/** Active paint chip: `null` = paint mode off; `categoryId: null` = eraser. */
		activePaint?: { categoryId: string | null } | null;
		/** Venue price categories, for painted-cell colors and names. */
		priceCategories?: PriceCategorySchema[];
		/**
		 * "Adjust seats" mode. While it is ON, a click SELECTS a seat for the
		 * inspector and a drag moves it; while it is off (or absent) every
		 * gesture keeps today's toggle/paint/rectangle semantics untouched.
		 */
		adjust?: SeatAdjustState | null;
		/**
		 * This cell's stored rotation in degrees (0 = none). A rotated seat draws
		 * the same orientation notch the buyer's map draws — see seat-rotation.ts.
		 */
		rotationFor?: (row: number, col: number) => number;
		/** Add `delta` (seat pitches) to this seat's own nudge, snapped. */
		onNudgeSeat?: (
			row: number,
			col: number,
			delta: { dx: number; dy: number },
			coarse: boolean
		) => void;
		/** Append one seat at the end of this row. */
		onAddSeatToRow?: (row: number) => void;
		/** Add a seat to the nearest row, nudged onto this world point. */
		onAddSeatAt?: (point: Coordinate2d) => void;
		/**
		 * Record an undo point — called BEFORE each mutation. A `coalesceKey`
		 * marks a continuous gesture (held arrow key) that should undo in one step.
		 */
		onBeforeEdit?: (coalesceKey?: string) => void;
		/**
		 * A NORMAL-mode mutation batch just finished (one call/click or drag-fill)
		 * and may have populated/emptied a row — adjust-mode already reindexes
		 * itself. `rowsBefore` is the snapshot taken BEFORE the batch.
		 */
		onCellsMutated?: (rowsBefore: number[]) => void;
	}

	const {
		seats,
		selectedCells,
		verticalAisles,
		horizontalAisles,
		rows,
		columns,
		invertRowOrder,
		getRowLabel,
		getSeatLabel,
		getCellKey,
		positions,
		shape = null,
		proposedShape = null,
		activePaint = null,
		priceCategories = [],
		adjust = null,
		rotationFor,
		onNudgeSeat,
		onAddSeatToRow,
		onAddSeatAt,
		onBeforeEdit,
		onCellsMutated
	}: Props = $props();

	const adjustActive = $derived(adjust?.active ?? false);
	const addArmed = $derived(adjustActive && (adjust?.addArmed ?? false));

	const drag = new SeatDragController(() => adjust, {
		cellPx: CELL_PX,
		onCommit: (row, col, delta, coarse) => {
			onBeforeEdit?.();
			onNudgeSeat?.(row, col, delta, coarse);
		}
	});

	/**
	 * A gesture that ends without committing (drag cancelled, or the mode left
	 * mid-drag) still produces a `click` on the button. Swallow exactly one, or
	 * an Escape mid-drag would fall through to the NORMAL-mode branch and
	 * toggle/select the cell the admin was only trying to move.
	 */
	let swallowNextClick = false;

	/** Leaving the mode mid-drag must abandon the gesture, not commit it. */
	$effect(() => {
		if (adjustActive) return;
		if (drag.isDragging) swallowNextClick = true;
		drag.cancel();
	});

	function handlePointerDown(row: number, col: number, event: PointerEvent) {
		if (!adjustActive || event.button !== 0) return;
		if (!seats.get(getCellKey(row, col))?.exists) return;
		adjust?.select({ row, col });
		drag.start(row, col, event);
		const target = event.currentTarget;
		if (target instanceof HTMLElement && typeof target.setPointerCapture === 'function') {
			target.setPointerCapture(event.pointerId);
		}
	}

	function handlePointerMove(event: PointerEvent) {
		// Gated on the mode: a pointermove after Escape must not revive the drag.
		if (adjustActive) drag.move(event);
	}

	function handlePointerUp(event: PointerEvent) {
		if (!adjustActive) {
			handlePointerCancel();
			return;
		}
		if (drag.finish(event)) swallowNextClick = true;
	}

	function handlePointerCancel() {
		if (drag.isDragging) swallowNextClick = true;
		drag.cancel();
	}

	// Arrow keys are the pointer-free equivalent of a drag: same nudge, same
	// snapping, coalesced into one undo entry while a key is held down.
	function handleCellKeydown(row: number, col: number, event: KeyboardEvent) {
		if (!adjustActive) return;
		const direction = ARROW_NUDGE[event.key];
		if (!direction || !seats.get(getCellKey(row, col))?.exists) return;
		event.preventDefault();
		adjust?.select({ row, col });
		const step = event.shiftKey ? NUDGE_COARSE_STEP : NUDGE_STEP;
		onBeforeEdit?.('nudge');
		onNudgeSeat?.(row, col, { dx: direction.dx * step, dy: direction.dy * step }, event.shiftKey);
	}

	/** One "add seat" button per row, anchored past the row's last seat. */
	const plusAnchors = $derived.by(() =>
		Array.from({ length: rows }, (_, row) => ({
			row,
			point: rowEndAnchor(positions, row, nextColumnInRow(seats, row))
		}))
	);

	// Add-anywhere: a click on free canvas becomes a world point (the per-row
	// "+" buttons are the precise keyboard path; see worldPointFromClick).
	function handleCanvasAdd(event: MouseEvent) {
		if (!addArmed || !(event.currentTarget instanceof HTMLElement)) return;
		onBeforeEdit?.();
		onAddSeatAt?.(worldPointFromClick(event.currentTarget.getBoundingClientRect(), event, frame));
	}

	const categoryById = $derived(
		new Map(priceCategories.flatMap((c) => (c.id ? [[c.id, c] as const] : [])))
	);

	// Apply the active paint chip to a cell holding a seat
	function paintCell(key: string) {
		if (!activePaint) return;
		const seat = seats.get(key);
		if (seat?.exists) {
			seats.set(key, { ...seat, priceCategoryId: activePaint.categoryId });
		}
	}

	/** Create a seat at an empty cell — may populate a row, so snapshot/reindex. */
	function addSeat(key: string, priceCategoryId?: string | null): void {
		const rowsBefore = populatedRowsOf(seats);
		seats.set(key, {
			exists: true,
			is_accessible: false,
			is_obstructed_view: false,
			priceCategoryId
		});
		onCellsMutated?.(rowsBefore);
	}

	// Normal-mode drag-to-select/fill gesture.
	const rectSelect = new SeatRectSelector();

	// Toggle single seat selection (for clicking on existing seats)
	function selectSeat(row: number, col: number) {
		const key = getCellKey(row, col);
		if (selectedCells.has(key)) {
			selectedCells.delete(key);
		} else {
			selectedCells.add(key);
		}
	}

	// Handle cell click
	function handleCellClick(row: number, col: number) {
		// If we were dragging, the drag handler already processed this
		if (rectSelect.isSelecting) return;
		if (swallowNextClick) {
			swallowNextClick = false;
			return;
		}

		// Adjust mode: a click SELECTS the seat for the inspector and never
		// toggles or paints it — that's the friction the mode exists for.
		if (adjustActive) {
			if (seats.get(getCellKey(row, col))?.exists) adjust?.select({ row, col });
			return;
		}

		const key = getCellKey(row, col);
		const seat = seats.get(key);
		// Every branch below mutates the grid, so record the undo point once here.
		onBeforeEdit?.();

		if (activePaint) {
			if (seat?.exists) {
				// Painting mode: clicking a seat paints it instead of selecting
				paintCell(key);
			} else if (activePaint.categoryId !== null) {
				// Painting an empty cell creates the seat already painted
				// (the eraser deliberately does nothing on empty cells)
				addSeat(key, activePaint.categoryId);
			}
			return;
		}

		if (seat?.exists) {
			// Clicking on existing seat: add to selection
			selectSeat(row, col);
		} else {
			// Clicking on empty cell: add a seat (don't clear selection)
			addSeat(key);
		}
	}

	// Handle mouse down - start potential drag selection
	function handleMouseDown(row: number, col: number, event: MouseEvent) {
		if (event.button !== 0 || adjustActive) return;
		rectSelect.down(row, col);
	}

	// Handle mouse move - only starts a live drag once it leaves the start cell
	function handleMouseMove(row: number, col: number) {
		if (adjustActive) return;
		rectSelect.move(row, col);
	}

	// Handle mouse up - finalize the drag gesture, if any (rectangle rules:
	// seat-grid-rect.ts). A fill can populate a swath of rows in one go, so
	// snapshot/reindex once, only when the gesture actually applied something.
	function handleMouseUp() {
		const input = rectSelect.finish({ seats, selectedCells, activePaint, keyFor: getCellKey });
		if (!input) return;
		const rowsBefore = populatedRowsOf(seats);
		onBeforeEdit?.();
		applyRectangle(input);
		onCellsMutated?.(rowsBefore);
	}

	// Check if cell is in current selection rectangle
	function isInSelectionRect(row: number, col: number): boolean {
		const bounds = rectSelect.bounds;
		if (!bounds) return false;
		return (
			row >= bounds.minRow && row <= bounds.maxRow && col >= bounds.minCol && col <= bounds.maxCol
		);
	}

	// Aisle mutations (stored as the index the aisle sits AFTER)
	function toggleVerticalAisle(afterCol: number) {
		onBeforeEdit?.();
		if (verticalAisles.has(afterCol)) verticalAisles.delete(afterCol);
		else verticalAisles.add(afterCol);
	}

	function toggleHorizontalAisle(afterRow: number) {
		onBeforeEdit?.();
		if (horizontalAisles.has(afterRow)) horizontalAisles.delete(afterRow);
		else horizontalAisles.add(afterRow);
	}

	/** Per-cell classes (seat-grid-cell-class.ts owns the visual language). */
	function getCellClass(row: number, col: number): string {
		const key = getCellKey(row, col);
		return seatCellClass({
			hasSeat: seats.get(key)?.exists ?? false,
			isSelected: selectedCells.has(key),
			inRect: isInSelectionRect(row, col),
			adjustActive,
			grabbing: adjust?.drag?.key === key,
			picked: adjust?.isSelected(row, col) ?? false
		});
	}

	/**
	 * A seat's body + label colour, inline because a price-category colour is
	 * USER DATA (the one legitimate exception to the raw-hue sweep rule).
	 * Unpainted seats take poster Periwinkle with an ink label — the exact pair
	 * the buyer's map draws, so a sector looks the same on both surfaces.
	 * Selection deliberately does NOT override the fill any more: the white ring
	 * says "selected" while the seat keeps showing what it is painted.
	 */
	function seatFillStyle(categoryColor?: string | null): string {
		return ` background-color: ${seatFill(categoryColor)}; color: ${seatGlyphColor(categoryColor)};`;
	}

	// --- Geometry -----------------------------------------------------------

	const verticalAisleList = $derived([...verticalAisles]);

	// The per-row "add seat" buttons sit one slot past each row's last seat, so
	// they take part in the frame — otherwise a full row's button would be drawn
	// outside the canvas and clipped.
	const frame = $derived.by(() =>
		canvasFrame({
			cells: [...positions.values(), ...plusAnchors.map(({ point }) => point)],
			polygons: [shape, proposedShape]
		})
	);

	function pointAt(row: number, col: number): Coordinate2d {
		return positions.get(getCellKey(row, col)) ?? { x: col, y: row };
	}

	/**
	 * A row's baseline y. Column 0 is always an arc ENDPOINT, so its baked y is
	 * the row's own y (curve sags the middle, never the ends) — which is what
	 * the row label and the horizontal aisle rail line up with.
	 */
	function rowY(row: number): number {
		return pointAt(row, 0).y;
	}

	/** A column's aisle-shifted x, independent of any row's curve/stagger. */
	function colX(col: number): number {
		return col + aisleShift(verticalAisleList, col);
	}

	function polyPoints(polygon: Coordinate2d[]): string {
		return polygon
			.map((p) => `${round(edgePx(p.x, frame.originX))},${round(edgePx(p.y, frame.originY))}`)
			.join(' ');
	}

	/**
	 * Shared chrome for the rail affordances. `--ring` is a purple halo on a
	 * poster panel (app.css spells out why it is 1.27:1 there), so everything
	 * focusable on this canvas declares amber instead — 9.42:1 on ink.
	 */
	const railButtonClass =
		'items-center justify-center focus-visible:outline focus-visible:outline-2 ' +
		'focus-visible:outline-offset-2 focus-visible:outline-poster-amber';

	/** Faint light bands marking the slot each aisle opens up. */
	const aisleBands = $derived.by(() => {
		const bands: Array<{ x: number; y: number; width: number; height: number }> = [];
		for (let c = 1; c < columns; c++) {
			if (!verticalAisles.has(c - 1)) continue;
			const { start, width } = gapBand(colX(c - 1), colX(c));
			if (width <= 0) continue;
			bands.push({
				x: round(edgePx(start, frame.originX)),
				y: 0,
				width: round(width * CELL_PX),
				height: frame.heightPx
			});
		}
		for (let r = 1; r < rows; r++) {
			if (!horizontalAisles.has(r - 1)) continue;
			const { start, width } = gapBand(rowY(r - 1), rowY(r));
			if (width <= 0) continue;
			bands.push({
				x: 0,
				y: round(edgePx(start, frame.originY)),
				width: frame.widthPx,
				height: round(width * CELL_PX)
			});
		}
		return bands;
	});
</script>

<svelte:window onmouseup={handleMouseUp} />

{#snippet stageBar()}
	<!-- The landing mock's stage pill, verbatim: white@14 over ink composites to
	     a near-ink strip, so the full-opacity white tracked label on it is
	     11.42:1 (hand-verified — a composited alpha over a poster value is
	     invisible to the audit script). An inverted sector puts the stage at the
	     BOTTOM, so the pill's round edge flips to face the seats. -->
	<div class="flex" style="padding-left: {RAIL_PX}px;">
		<div class="flex justify-center" style="width: {frame.widthPx}px;">
			<div
				data-testid="seat-grid-stage"
				class="{invertRowOrder
					? 'rounded-b-full rounded-t-md'
					: 'rounded-b-md rounded-t-full'} bg-poster-white/[0.14] px-8 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.2em] text-poster-white"
			>
				{m['seatGridEditor.stage']()}
			</div>
		</div>
	</div>
{/snippet}

<!-- The editing canvas IS the room: one poster-ink panel, identical in light and
     dark (imagery rule), with the rails and their aisle affordances riding on it
     in white. Everything outside this panel — the palette, the geometry panel,
     the legend — stays on theme tokens. -->
<div class="overflow-x-auto rounded-[20px] bg-poster-ink p-4 shadow-poster">
	<div class="inline-block">
		<!-- Stage indicator. Baked positions NEVER flip under invertRowOrder, so
		     an inverted sector's front row (rank 0) carries the LARGEST y and the
		     stage bar moves to the BOTTOM — the convention SeatLayoutPreview and
		     the curve help already ship. -->
		{#if !invertRowOrder}
			<div class="mb-4">{@render stageBar()}</div>
		{/if}

		<!-- Column labels + vertical-aisle zones -->
		<div class="flex">
			<div class="shrink-0" style="width: {RAIL_PX}px; height: {COL_RAIL_PX}px;"></div>
			<div class="relative" style="width: {frame.widthPx}px; height: {COL_RAIL_PX}px;">
				{#each Array(columns) as _, c (c)}
					<div
						class="absolute bottom-0 flex items-end justify-center text-xs font-bold text-poster-white/80"
						style="left: {round(
							centerPx(colX(c), frame.originX) - CELL_PX / 2
						)}px; width: {CELL_PX}px;"
					>
						{c + 1}
					</div>
					{#if c > 0}
						{@const hasAisle = verticalAisles.has(c - 1)}
						<div
							class="group absolute bottom-0 flex items-end justify-center"
							style="left: {round(
								edgePx(gapCenter(colX(c - 1), colX(c)), frame.originX) - AISLE_ZONE_PX / 2
							)}px; width: {AISLE_ZONE_PX}px; height: {COL_RAIL_PX}px;"
						>
							{#if hasAisle}
								<button
									type="button"
									onclick={() => toggleVerticalAisle(c - 1)}
									class="{railButtonClass} flex h-full w-full text-xs text-poster-amber hover:text-poster-crimson"
									title={m['seatGridEditor.removeAisleAfterColumn']({ column: c })}
								>
									|
								</button>
							{:else}
								<button
									type="button"
									onclick={() => toggleVerticalAisle(c - 1)}
									class="{railButtonClass} hidden h-6 w-full rounded-full bg-poster-white/15 text-poster-white opacity-0 transition-opacity group-hover:flex group-hover:opacity-100"
									title={m['seatGridEditor.addAisleAfterColumn']({ column: c })}
								>
									<Plus class="h-3 w-3" />
								</button>
							{/if}
						</div>
					{/if}
				{/each}
			</div>
		</div>

		<!-- Row labels + horizontal-aisle zones, then the geometry canvas -->
		<div class="flex">
			<div class="relative shrink-0" style="width: {RAIL_PX}px; height: {frame.heightPx}px;">
				{#each Array(rows) as _, r (r)}
					<div
						class="absolute flex w-full items-center justify-center text-xs font-bold text-poster-white/80"
						style="top: {round(centerPx(rowY(r), frame.originY) - 10)}px; height: 20px;"
					>
						{getRowLabel(r)}
					</div>
					{#if r > 0}
						{@const hasAisle = horizontalAisles.has(r - 1)}
						<div
							class="group absolute flex w-full items-center justify-center"
							style="top: {round(
								edgePx(gapCenter(rowY(r - 1), rowY(r)), frame.originY) - AISLE_ZONE_PX / 2
							)}px; height: {AISLE_ZONE_PX}px;"
						>
							{#if hasAisle}
								<button
									type="button"
									onclick={() => toggleHorizontalAisle(r - 1)}
									class="{railButtonClass} flex h-full w-full text-xs text-poster-amber hover:text-poster-crimson"
									title={m['seatGridEditor.removeAisleAfterRow']({ row: getRowLabel(r - 1) })}
								>
									—
								</button>
							{:else}
								<button
									type="button"
									onclick={() => toggleHorizontalAisle(r - 1)}
									class="{railButtonClass} hidden h-full w-full rounded-full bg-poster-white/15 text-poster-white opacity-0 transition-opacity group-hover:flex group-hover:opacity-100"
									title={m['seatGridEditor.addAisleAfterRow']({ row: getRowLabel(r - 1) })}
								>
									<Plus class="h-3 w-3" />
								</button>
							{/if}
						</div>
					{/if}
				{/each}
			</div>

			<div
				class="relative"
				data-testid="seat-grid-canvas"
				style="width: {frame.widthPx}px; height: {frame.heightPx}px;"
			>
				<!-- Underlay: aisle bands + the sector outline, in the SAME frame as
				     the buttons (origin = min over baked cells and outline vertices). -->
				<svg
					class="pointer-events-none absolute inset-0"
					width={frame.widthPx}
					height={frame.heightPx}
					viewBox="0 0 {frame.widthPx} {frame.heightPx}"
					aria-hidden="true"
				>
					{#each aisleBands as band, index (index)}
						<rect
							x={band.x}
							y={band.y}
							width={band.width}
							height={band.height}
							class="fill-poster-white/[0.08]"
							data-testid="seat-grid-aisle-band"
						/>
					{/each}
					{#if shape}
						<polygon
							points={polyPoints(shape)}
							data-testid="seat-grid-shape"
							fill="none"
							stroke="hsl(var(--poster-white) / 0.35)"
							stroke-width="2"
						/>
					{/if}
					{#if proposedShape}
						<polygon
							points={polyPoints(proposedShape)}
							data-testid="seat-grid-proposed-shape"
							fill="none"
							stroke="hsl(var(--poster-amber))"
							stroke-width="2"
							stroke-dasharray="6 4"
						/>
					{/if}
				</svg>

				{#if addArmed}
					<!-- Add-anywhere target. It sits UNDER the seat buttons (which stay
					     clickable for selection) and OVER the empty cells, which go
					     pointer-events-none while armed, so every click on free canvas
					     lands here with its exact coordinates. Keyboard users get the
					     precise per-row "+" buttons instead; see handleCanvasAdd. -->
					<button
						type="button"
						data-testid="seat-grid-add-anywhere"
						class="absolute inset-0 z-0 cursor-crosshair rounded-[16px] bg-poster-white/5 ring-1 ring-inset ring-poster-amber/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-poster-amber"
						aria-label={m['seatGridEditor.adjust.addAnywhereTarget']()}
						onclick={handleCanvasAdd}
					></button>
				{/if}

				{#each plusAnchors as anchor (anchor.row)}
					<button
						type="button"
						data-testid="seat-grid-add-to-row"
						data-row={anchor.row}
						class="absolute z-20 flex items-center justify-center rounded-full border border-dashed border-poster-white/50 text-poster-white transition-colors hover:border-poster-amber hover:bg-poster-white/15 hover:text-poster-amber focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-poster-amber"
						style={markerStyle(anchor.point, frame, 24)}
						aria-label={m['seatGridEditor.adjust.addSeatToRow']({
							row: getRowLabel(anchor.row)
						})}
						onclick={() => {
							onBeforeEdit?.();
							onAddSeatToRow?.(anchor.row);
						}}
					>
						<Plus class="h-3.5 w-3.5" aria-hidden="true" />
					</button>
				{/each}

				{#each Array(rows) as _, r (r)}
					{#each Array(columns) as _, c (c)}
						{@const cellKey = getCellKey(r, c)}
						{@const seatData = seats.get(cellKey)}
						{@const paint =
							seatData?.exists && seatData.priceCategoryId
								? categoryById.get(seatData.priceCategoryId)
								: undefined}
						<button
							type="button"
							data-cell={cellKey}
							disabled={adjustActive && !seatData?.exists}
							class={getCellClass(r, c)}
							style="{cellButtonStyle(
								pointAt(r, c),
								frame,
								adjust?.offsetFor(cellKey)
							)} width: {BUTTON_PX}px; height: {BUTTON_PX}px;{seatData?.exists
								? seatFillStyle(paint?.color)
								: ''}"
							title={paint?.name}
							onmousedown={(e) => handleMouseDown(r, c, e)}
							onmouseenter={() => handleMouseMove(r, c)}
							onclick={() => handleCellClick(r, c)}
							onpointerdown={(e) => handlePointerDown(r, c, e)}
							onpointermove={(e) => handlePointerMove(e)}
							onpointerup={(e) => handlePointerUp(e)}
							onpointercancel={() => handlePointerCancel()}
							onkeydown={(e) => handleCellKeydown(r, c, e)}
							aria-label={`${m['seatGridEditor.seatLabel']({
								seat: getSeatLabel(r, c),
								accessible: seatData?.is_accessible
									? m['seatGridEditor.seatAccessibleSuffix']()
									: '',
								obstructed: seatData?.is_obstructed_view
									? m['seatGridEditor.seatObstructedSuffix']()
									: ''
							})}${paint ? `, ${paint.name}` : ''}`}
						>
							{#if seatData?.exists}
								<SeatRotationNotch rot={rotationFor?.(r, c) ?? 0} size={BUTTON_PX} />
								<span>{getSeatLabel(r, c)}</span>
								<!-- Indicator icons. They sit on their OWN ink chip rather than on
								     the seat, because a seat's fill is the organizer's colour and
								     nothing can be promised about contrast on it; on ink,
								     Periwinkle is 8.36:1 and Amber 9.42:1. They differ by SHAPE
								     too, and both are already named in the cell's accessible
								     label, so they are never the only carrier. -->
								{#if seatData.is_accessible || seatData.is_obstructed_view}
									<div
										class="absolute -bottom-1 -right-1 flex gap-0.5 rounded-full bg-poster-ink p-0.5"
									>
										{#if seatData.is_accessible}
											<Accessibility class="h-3 w-3 text-poster-periwinkle" />
										{/if}
										{#if seatData.is_obstructed_view}
											<EyeOff class="h-3 w-3 text-poster-amber" />
										{/if}
									</div>
								{/if}
							{/if}
						</button>
					{/each}
				{/each}
			</div>
		</div>

		{#if invertRowOrder}
			<div class="mt-4">{@render stageBar()}</div>
		{/if}
	</div>
</div>
