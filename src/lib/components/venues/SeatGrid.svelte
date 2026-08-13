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
	 */
	import * as m from '$lib/paraglide/messages.js';
	import { Plus, Accessibility, EyeOff } from '@lucide/svelte';
	import type { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import type { Coordinate2d, PriceCategorySchema } from '$lib/api/generated/types.gen';
	import type { SeatData } from './seat-grid-types';
	import { paintTextColor } from './seat-grid-save';
	import { aisleShift } from './seat-layout-bake';
	import {
		ARROW_NUDGE,
		NUDGE_COARSE_STEP,
		NUDGE_STEP,
		SeatDragController,
		nextColumnInRow,
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
		onNudgeSeat,
		onAddSeatToRow,
		onAddSeatAt,
		onBeforeEdit
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

	// Selection state
	let isSelecting = $state(false);
	let selectionStart = $state<{ row: number; col: number } | null>(null);
	let selectionEnd = $state<{ row: number; col: number } | null>(null);

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
		if (isSelecting) return;

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
				seats.set(key, {
					exists: true,
					is_accessible: false,
					is_obstructed_view: false,
					priceCategoryId: activePaint.categoryId
				});
			}
			return;
		}

		if (seat?.exists) {
			// Clicking on existing seat: add to selection
			selectSeat(row, col);
		} else {
			// Clicking on empty cell: add a seat (don't clear selection)
			seats.set(key, { exists: true, is_accessible: false, is_obstructed_view: false });
		}
	}

	// Handle mouse down - start potential drag selection
	function handleMouseDown(row: number, col: number, event: MouseEvent) {
		if (event.button !== 0 || adjustActive) return;

		// Store start position for potential drag
		selectionStart = { row, col };
		selectionEnd = { row, col };
		// Don't set isSelecting yet - only set it if mouse moves to different cell
		// Don't clear selection - let clicks accumulate
	}

	// Handle mouse move - update selection (only start drag if moved to different cell)
	function handleMouseMove(row: number, col: number) {
		if (!selectionStart || adjustActive) return;

		// Only start drag selection if mouse moved to a different cell
		if (!isSelecting && (row !== selectionStart.row || col !== selectionStart.col)) {
			isSelecting = true;
		}

		if (isSelecting) {
			selectionEnd = { row, col };
		}
	}

	// Handle mouse up - finalize drag selection (if any)
	function handleMouseUp() {
		// If we weren't dragging, just reset and let click handler work
		if (!isSelecting) {
			selectionStart = null;
			selectionEnd = null;
			return;
		}

		// We were dragging - finalize the selection
		if (!selectionStart || !selectionEnd) {
			isSelecting = false;
			selectionStart = null;
			selectionEnd = null;
			return;
		}

		// Calculate selection rectangle
		onBeforeEdit?.();
		const minRow = Math.min(selectionStart.row, selectionEnd.row);
		const maxRow = Math.max(selectionStart.row, selectionEnd.row);
		const minCol = Math.min(selectionStart.col, selectionEnd.col);
		const maxCol = Math.max(selectionStart.col, selectionEnd.col);

		if (activePaint) {
			// Painting mode: drag paints every existing seat in the rectangle
			for (let r = minRow; r <= maxRow; r++) {
				for (let c = minCol; c <= maxCol; c++) {
					paintCell(getCellKey(r, c));
				}
			}
			isSelecting = false;
			selectionStart = null;
			selectionEnd = null;
			return;
		}

		// Check if both start and end cells are empty
		const startKey = getCellKey(selectionStart.row, selectionStart.col);
		const endKey = getCellKey(selectionEnd.row, selectionEnd.col);
		const startEmpty = !seats.get(startKey)?.exists;
		const endEmpty = !seats.get(endKey)?.exists;

		if (startEmpty && endEmpty) {
			// Fill the selection rectangle with seats
			for (let r = minRow; r <= maxRow; r++) {
				for (let c = minCol; c <= maxCol; c++) {
					seats.set(getCellKey(r, c), {
						exists: true,
						is_accessible: false,
						is_obstructed_view: false
					});
				}
			}
		} else {
			// Select all cells in rectangle that have seats (add to existing selection)
			for (let r = minRow; r <= maxRow; r++) {
				for (let c = minCol; c <= maxCol; c++) {
					const key = getCellKey(r, c);
					if (seats.get(key)?.exists) {
						selectedCells.add(key);
					}
				}
			}
		}

		isSelecting = false;
		selectionStart = null;
		selectionEnd = null;
	}

	// Check if cell is in current selection rectangle
	function isInSelectionRect(row: number, col: number): boolean {
		if (!isSelecting || !selectionStart || !selectionEnd) return false;

		const minRow = Math.min(selectionStart.row, selectionEnd.row);
		const maxRow = Math.max(selectionStart.row, selectionEnd.row);
		const minCol = Math.min(selectionStart.col, selectionEnd.col);
		const maxCol = Math.max(selectionStart.col, selectionEnd.col);

		return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol;
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

	// Get cell class
	function getCellClass(row: number, col: number): string {
		const key = getCellKey(row, col);
		const seatData = seats.get(key);
		const hasSeat = seatData?.exists ?? false;
		const isSelected = selectedCells.has(key);
		const inRect = isInSelectionRect(row, col);

		const base =
			'absolute rounded transition-colors duration-75 flex items-center justify-center text-xs font-medium select-none';

		if (adjustActive) {
			// Empty cells are inert in this mode (nothing to select or drag), so
			// they step out of the way entirely: no pointer target — which is what
			// lets a click on free canvas reach the add-anywhere layer — and,
			// paired with `disabled` on the button, no tab stop either.
			if (!hasSeat) {
				return `${base} pointer-events-none border-2 border-dashed border-muted-foreground/20 text-muted-foreground/30`;
			}
			const grabbing = adjust?.drag?.key === key;
			const picked = adjust?.isSelected(row, col) ?? false;
			return `${base} touch-none bg-success text-success-foreground z-10 ${
				grabbing ? 'cursor-grabbing opacity-90 z-30' : 'cursor-grab'
			} ${picked ? 'ring-2 ring-primary ring-offset-2 z-30' : ''}`;
		}

		if (isSelected) {
			return `${base} bg-primary text-primary-foreground ring-2 ring-primary ring-offset-1 z-20`;
		}

		if (inRect) {
			return `${base} ${hasSeat ? 'bg-primary/70 text-primary-foreground' : 'bg-primary/30'} ring-1 ring-primary z-20`;
		}

		if (hasSeat) {
			return `${base} bg-success text-success-foreground hover:bg-success/85 cursor-pointer z-10`;
		}

		// Empty cell - visible border in both light and dark mode
		return `${base} bg-muted/20 hover:bg-muted/40 border-2 border-muted-foreground/20 hover:border-muted-foreground/40 text-muted-foreground/30 cursor-pointer`;
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

	/** Amber bands marking the slot each aisle opens up. */
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
	<div class="flex" style="padding-left: {RAIL_PX}px;">
		<div class="flex justify-center" style="width: {frame.widthPx}px;">
			<div
				data-testid="seat-grid-stage"
				class="rounded-lg bg-muted px-8 py-2 text-sm font-medium text-muted-foreground"
			>
				{m['seatGridEditor.stage']()}
			</div>
		</div>
	</div>
{/snippet}

<!-- Grid -->
<div class="overflow-x-auto rounded-lg border bg-card p-4">
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
						class="absolute bottom-0 flex items-end justify-center text-xs font-medium text-muted-foreground"
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
									class="flex h-full w-full items-center justify-center text-xs text-primary hover:text-destructive"
									title={m['seatGridEditor.removeAisleAfterColumn']({ column: c })}
								>
									|
								</button>
							{:else}
								<button
									type="button"
									onclick={() => toggleVerticalAisle(c - 1)}
									class="hidden h-6 w-full items-center justify-center rounded bg-primary/10 text-primary opacity-0 transition-opacity group-hover:flex group-hover:opacity-100"
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
						class="absolute flex w-full items-center justify-center text-xs font-medium text-muted-foreground"
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
									class="flex h-full w-full items-center justify-center text-xs text-highlight-foreground hover:text-destructive dark:text-highlight"
									title={m['seatGridEditor.removeAisleAfterRow']({ row: getRowLabel(r - 1) })}
								>
									—
								</button>
							{:else}
								<button
									type="button"
									onclick={() => toggleHorizontalAisle(r - 1)}
									class="hidden h-full w-full items-center justify-center rounded bg-primary/10 text-primary opacity-0 transition-opacity group-hover:flex group-hover:opacity-100"
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
							class="fill-highlight/25"
							data-testid="seat-grid-aisle-band"
						/>
					{/each}
					{#if shape}
						<polygon
							points={polyPoints(shape)}
							data-testid="seat-grid-shape"
							fill="none"
							stroke="hsl(var(--border))"
							stroke-width="2"
						/>
					{/if}
					{#if proposedShape}
						<polygon
							points={polyPoints(proposedShape)}
							data-testid="seat-grid-proposed-shape"
							fill="none"
							stroke="hsl(var(--primary))"
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
						class="absolute inset-0 z-0 cursor-crosshair rounded bg-primary/5 ring-1 ring-inset ring-primary/30"
						aria-label={m['seatGridEditor.adjust.addAnywhereTarget']()}
						onclick={handleCanvasAdd}
					></button>
				{/if}

				{#each plusAnchors as anchor (anchor.row)}
					<button
						type="button"
						data-testid="seat-grid-add-to-row"
						data-row={anchor.row}
						class="absolute z-20 flex items-center justify-center rounded-full border border-dashed border-primary/50 bg-card text-primary transition-colors hover:border-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
						{@const paintOverridden = selectedCells.has(cellKey) || isInSelectionRect(r, c)}
						<button
							type="button"
							data-cell={cellKey}
							disabled={adjustActive && !seatData?.exists}
							class={getCellClass(r, c)}
							style="{cellButtonStyle(
								pointAt(r, c),
								frame,
								adjust?.offsetFor(cellKey)
							)} width: {BUTTON_PX}px; height: {BUTTON_PX}px;{paint && !paintOverridden
								? ` background-color: ${paint.color}; color: ${paintTextColor(paint.color)};`
								: ''}"
							title={paint?.name}
							onmousedown={(e) => handleMouseDown(r, c, e)}
							onmouseenter={() => handleMouseMove(r, c)}
							onclick={() => handleCellClick(r, c)}
							onpointerdown={(e) => handlePointerDown(r, c, e)}
							onpointermove={(e) => drag.move(e)}
							onpointerup={(e) => drag.finish(e)}
							onpointercancel={() => drag.cancel()}
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
								<span class="text-[10px]">{getSeatLabel(r, c)}</span>
								<!-- Indicator icons -->
								{#if seatData.is_accessible || seatData.is_obstructed_view}
									<div
										class="absolute -bottom-1 -right-1 flex gap-0.5 rounded bg-card/90 p-0.5 shadow-sm"
									>
										{#if seatData.is_accessible}
											<Accessibility class="h-3 w-3 text-info" />
										{/if}
										{#if seatData.is_obstructed_view}
											<EyeOff class="h-3 w-3 text-highlight-foreground dark:text-highlight" />
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
