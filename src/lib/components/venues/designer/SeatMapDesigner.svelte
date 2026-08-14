<script lang="ts">
	/**
	 * Sector-block arranger + stage placement (#659 designer v2) — view layer.
	 *
	 * One SVG canvas shows the whole venue floor in WORLD space (matching the
	 * buyer map's group-transform idiom: each sector is a `<g translate rotate>`
	 * placed by its `SectorTransform`). All interaction state and handlers live in
	 * DesignerController; this component only renders it. You SELECT a sector block
	 * or the stage, DRAG to move, ROTATE a selected sector via its handle (snaps to
	 * 15°), and DRAW/EDIT its outline polygon. Panning is always available by
	 * dragging empty canvas, space+drag or middle-mouse; wheel/pinch zoom.
	 *
	 * Keyboard: Tab reaches every block and the stage; Enter selects, arrows nudge
	 * the selection, `[`/`]` (or `,`/`.`) rotate a selected sector by 15°, Escape
	 * deselects. In shape mode each vertex is focusable (arrows nudge, Delete
	 * removes); click empty canvas to append a vertex.
	 *
	 * VISUAL LANGUAGE (#852): this canvas is the same room the sector editor and
	 * the buyer's map draw — the landing mock's mode-inert poster-ink house with
	 * solid round seat dots in their price-category colour (poster Periwinkle when
	 * unpainted, via `tickets/seat-map-paint.ts`) and the mock's stage pill.
	 * Because everything here is also an interaction TARGET, the designer's own
	 * cues sit on top of that language: SELECTION is white geometry, FOCUS is
	 * poster amber, both drawn as real SVG shapes — an `outline` utility is
	 * silently inert on an SVG container (it has no box model), which is exactly
	 * how the buyer map's amber ring was never actually painting (see the seat
	 * focus ring in SeatMap.svelte). Everything AROUND the panel — toolbar, floor
	 * bar, instructions, error panels — stays on theme tokens.
	 */
	import * as m from '$lib/paraglide/messages.js';
	import type { Coordinate2d, PriceCategorySchema } from '$lib/api/generated/types.gen';
	import { Minus, Plus, RotateCcw } from '@lucide/svelte';
	import DesignerFloorBar from './DesignerFloorBar.svelte';
	import DesignerGhostBlock from './DesignerGhostBlock.svelte';
	import DesignerToolbar from './DesignerToolbar.svelte';
	import { seatFill } from '$lib/components/tickets/seat-map-paint';
	import { CELL, HANDLE_PX, DesignerController } from './designer-controller.svelte';
	import { midpoint } from './designer-geometry';
	import { blockWorldBounds, type DesignerBlock, type DesignerModel } from './designer-model';
	import type { DesignerSavePlan } from './designer-save';

	interface Props {
		model: DesignerModel;
		isSaving: boolean;
		/** Persist the plan; resolve true when everything was written. */
		onSave: (plan: DesignerSavePlan) => Promise<boolean>;
		onDirtyChange?: (dirty: boolean) => void;
		/** Link target for a sector's grid editor. */
		sectorEditorHref: (sectorId: string) => string;
		/**
		 * Venue price categories, for seat colours only. Absent (still loading, or
		 * the venue has none) simply means every seat draws in the unpainted
		 * default — the canvas never waits on them.
		 */
		priceCategories?: PriceCategorySchema[];
	}

	const {
		model,
		isSaving,
		onSave,
		onDirtyChange,
		sectorEditorHref,
		priceCategories = []
	}: Props = $props();

	const uid = $props.id();
	// The route freezes `model` on first load and `onSave` is stable, so capturing
	// them once in the controller is intentional.
	// svelte-ignore state_referenced_locally
	const c = new DesignerController(model, onSave);

	$effect(() => {
		onDirtyChange?.(c.dirty);
	});

	// Each floor is its own canvas: only the active floor's blocks render (all
	// of them when the venue has no floors — the flattened plane). The rest are
	// drawn as inert onion-skin ghosts so a block is never placed blind on top of
	// what sits on the floor below.
	const visibleBlocks = $derived(model.blocks.filter((block) => c.floorState.isVisible(block.id)));
	const ghostBlocks = $derived(model.blocks.filter((block) => !c.floorState.isVisible(block.id)));

	/** Seat dot radius (px). The buyer map's dot at the same CELL, one size down. */
	const SEAT_R = 10;

	const categoryById = $derived(
		new Map(priceCategories.flatMap((category) => (category.id ? [[category.id, category]] : [])))
	);

	/** A seat's body colour: its price-category colour, else poster Periwinkle. */
	function dotFill(priceCategoryId: string | null): string {
		return seatFill(priceCategoryId ? categoryById.get(priceCategoryId)?.color : null);
	}

	function activateFloor(floorId: string): void {
		c.floorState.activeFloorId = floorId;
		// A selection living on another floor would be an invisible drag/rotate
		// target — drop it (the stage is only selectable while visible too).
		if (c.selectedSectorId && !c.floorState.isVisible(c.selectedSectorId)) c.deselect();
		if (c.stageSelected && !c.floorState.stageVisible) c.deselect();
	}

	const DEFAULT_STAGE_HALF = 4; // fallback stage bar half-width (units)

	function blockLabel(block: DesignerBlock): string {
		const rotation = Math.round(c.transformOf(block.id).rotation);
		return (
			m['seatDesigner.sectorBlockLabel']?.({ name: block.name, rotation }) ??
			`${block.name}, ${rotation}°`
		);
	}
	const stageName = $derived(m['seatDesigner.stageName']?.() ?? 'Stage');
	function vertexLabel(index: number, name: string): string {
		return m['seatDesigner.vertexLabel']({ index: index + 1, sector: name });
	}

	function onWindowKeydown(event: KeyboardEvent) {
		const el = event.target as HTMLElement | null;
		if (event.key === ' ' && el && !/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) {
			c.setSpaceHeld(true);
		}
	}
	function onWindowKeyup(event: KeyboardEvent) {
		if (event.key === ' ') c.setSpaceHeld(false);
	}

	/**
	 * Zoom chrome ON the ink panel — the buyer map's recipe verbatim (SeatMap
	 * declares the measured numbers): a white@10 face, full white glyph, and its
	 * own poster-amber focus ring because `--ring` is a purple halo on a poster
	 * panel (1.27:1 light / 2.07:1 dark), while amber on ink is 9.42:1.
	 */
	const zoomButtonClass =
		'flex h-9 w-9 items-center justify-center rounded-full border border-poster-white/20 ' +
		'bg-poster-white/10 text-poster-white transition-colors hover:bg-poster-white/20 ' +
		'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ' +
		'focus-visible:outline-poster-amber [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11';

	/**
	 * Keyboard focus is drawn as real SVG geometry (an amber rect around the
	 * element's own local box), never as an `outline` utility — an SVG `<g>` has
	 * no box model, so the utility is silently inert and the UA's own ring wins.
	 * `outline-none` on those groups is safe ONLY because this replacement
	 * exists. The box is the union of the block's local frame and its outline, so
	 * a concave shape poking past the frame is never clipped out of its own ring.
	 */
	const FOCUS_PAD = 6;

	function focusBox(
		points: Coordinate2d[] | null,
		frame: { x: number; y: number; width: number; height: number } | null
	): { x: number; y: number; width: number; height: number } {
		const xs: number[] = [];
		const ys: number[] = [];
		if (frame) {
			xs.push(frame.x, frame.x + frame.width);
			ys.push(frame.y, frame.y + frame.height);
		}
		for (const point of points ?? []) {
			xs.push(point.x * CELL);
			ys.push(point.y * CELL);
		}
		if (xs.length === 0)
			return { x: -FOCUS_PAD, y: -FOCUS_PAD, width: 2 * FOCUS_PAD, height: 2 * FOCUS_PAD };
		const minX = Math.min(...xs);
		const minY = Math.min(...ys);
		return {
			x: minX - FOCUS_PAD,
			y: minY - FOCUS_PAD,
			width: Math.max(...xs) - minX + FOCUS_PAD * 2,
			height: Math.max(...ys) - minY + FOCUS_PAD * 2
		};
	}

	const stageFocusBox = $derived(
		focusBox(
			c.stage.shape,
			c.stage.shape
				? null
				: {
						x: -DEFAULT_STAGE_HALF * CELL,
						y: -0.75 * CELL,
						width: DEFAULT_STAGE_HALF * 2 * CELL,
						height: 1.5 * CELL
					}
		)
	);

	/** Canvas-space anchor for a ghost block's upright name (never rotated). */
	function ghostLabelAt(block: DesignerBlock): { x: number; y: number } {
		const bounds = blockWorldBounds(block, c.transformOf(block.id));
		return { x: c.px((bounds.minX + bounds.maxX) / 2), y: c.py(bounds.minY) - 6 };
	}

	/** Footprint edge: white geometry says SELECTED, everywhere on this canvas. */
	function edgeClass(selected: boolean): string {
		return selected ? 'stroke-poster-white' : 'stroke-poster-white/40';
	}
</script>

<svelte:window onkeydown={onWindowKeydown} onkeyup={onWindowKeyup} />

<!--
	Shape-mode handles. Every one of them is focusable itself (not a container),
	so its amber focus ring is a `peer-focus-visible` SIBLING circle, scoped by a
	wrapping <g> — with a bare `~` the ring of every LATER handle would light up
	too. White = a handle, amber = the focused one, solid vs hollow = selected vs
	not: lightness and shape, never hue alone.
-->
{#snippet vertexEditor(points: Coordinate2d[] | null, name: string)}
	{#if points}
		{#if points.length >= 2}
			{#each points as vertex, index (index)}
				{@const mid = midpoint(vertex, points[(index + 1) % points.length])}
				<g>
					<circle
						role="button"
						tabindex="0"
						aria-label={m['seatDesigner.addVertex']?.() ?? 'Add shape point'}
						cx={mid.x * CELL}
						cy={mid.y * CELL}
						r="4"
						class="peer cursor-copy fill-poster-ink stroke-poster-white/70 outline-none"
						stroke-width="1.5"
						stroke-dasharray="2 2"
						onpointerdown={(event) => {
							event.stopPropagation();
							c.insertOnEdge(index);
						}}
						onkeydown={(event) => {
							if (event.key === 'Enter' || event.key === ' ') {
								event.preventDefault();
								c.insertOnEdge(index);
							}
						}}
					/>
					<circle
						cx={mid.x * CELL}
						cy={mid.y * CELL}
						r="9"
						fill="none"
						stroke-width="2"
						class="pointer-events-none stroke-poster-amber opacity-0 peer-focus-visible:opacity-100"
					/>
				</g>
			{/each}
		{/if}
		{#each points as vertex, index (index)}
			<g>
				<circle
					role="button"
					tabindex="0"
					aria-label={vertexLabel(index, name)}
					cx={vertex.x * CELL}
					cy={vertex.y * CELL}
					r="6"
					class="peer cursor-move outline-none {index === c.selectedVertex
						? 'fill-poster-white stroke-poster-ink'
						: 'fill-poster-ink stroke-poster-white'}"
					stroke-width="2"
					onpointerdown={(event) => c.onVertexPointerDown(event, index)}
					onkeydown={(event) => c.onVertexKeydown(event, index)}
				/>
				<circle
					cx={vertex.x * CELL}
					cy={vertex.y * CELL}
					r="11"
					fill="none"
					stroke-width="2"
					class="pointer-events-none stroke-poster-amber opacity-0 peer-focus-visible:opacity-100"
				/>
			</g>
		{/each}
	{/if}
{/snippet}

<div class="space-y-4">
	<DesignerToolbar
		blocks={visibleBlocks}
		selectionValue={c.selectionValue}
		selectedSectorId={c.selectedSectorId}
		mode={c.mode}
		snapOn={c.snapOn}
		selectedHasShape={c.selectedHasShape}
		shapeInvalid={c.shapeInvalid}
		dirty={c.dirty}
		{isSaving}
		{sectorEditorHref}
		onSelectChange={(value) => c.onSelectChange(value)}
		onSnapToggle={() => c.toggleSnap()}
		onEnterShapeMode={() => c.enterShapeMode()}
		onExitShapeMode={() => c.exitShapeMode()}
		onClearShape={() => c.clearShape()}
		onSave={() => c.save()}
	/>

	<DesignerFloorBar
		floorState={c.floorState}
		selectedSectorId={c.selectedSectorId}
		onActivateFloor={activateFloor}
	/>

	<p id="{uid}-instructions" class="text-sm text-muted-foreground">
		{#if c.mode === 'shape'}
			{m['seatDesigner.shapeInstructions']()}
		{:else if c.selection}
			{m['seatDesigner.instructions']()}
		{:else}
			{m['seatDesigner.selectPrompt']?.() ?? m['seatDesigner.instructions']()}
		{/if}
	</p>

	{#if c.shapeInvalid}
		<p class="text-sm font-medium text-destructive" role="alert">
			{m['seatDesigner.shapeTooFewPoints']()}
		</p>
	{/if}

	{#if c.saveIssues && (c.saveIssues.violations.length > 0 || c.saveIssues.invalidShapeSectors.length > 0)}
		<div class="rounded-md bg-destructive/10 p-4 text-sm text-destructive" role="alert">
			{#each c.saveIssues.invalidShapeSectors as sector (sector.sectorId)}
				<p>{sector.sectorName}: {m['seatDesigner.shapeTooFewPoints']()}</p>
			{/each}
			{#each c.saveIssues.violations as violation (violation.sectorId)}
				<p>
					{m['seatDesigner.seatsOutsideShape']({ sector: violation.sectorName })}
					{violation.seatLabels.join(', ')}
				</p>
			{/each}
		</div>
	{/if}

	<!-- The canvas IS the room: the landing mock's poster-ink house, identical in
	     light and dark (imagery rule — it is a picture of a venue, not a surface).
	     Every cue drawn on it below carries its own poster treatment. -->
	<div class="relative overflow-hidden rounded-[20px] bg-poster-ink shadow-poster">
		<svg
			bind:this={c.vp.svgEl}
			use:c.vp.wheel
			viewBox="0 0 {c.contentW} {c.contentH}"
			preserveAspectRatio="xMidYMid meet"
			class="h-[60vh] max-h-[900px] w-full touch-none select-none {c.spaceHeld
				? 'cursor-grab'
				: ''}"
			role="application"
			aria-label={m['seatDesigner.canvasLabel']()}
			aria-describedby="{uid}-instructions"
			onpointerdown={(event) => c.onCanvasPointerDown(event)}
			onpointermove={(event) => c.onCanvasPointerMove(event)}
			onpointerup={(event) => c.onCanvasPointerEnd(event)}
			onpointercancel={(event) => c.onCanvasPointerEnd(event)}
		>
			<g transform="translate({c.vp.tx} {c.vp.ty}) scale({c.vp.scale})">
				<!-- Stage: the venue's single stage has no floor field; by convention it
				     belongs to the FIRST (ground) floor, so other floors hide it. -->
				{#if c.floorState.stageVisible}
					<!-- The landing mock's stage pill (white@14 body, full-white tracked
					     uppercase label — 11.42:1, hand-verified and registered in
					     COMPOSITED_PAIRS), plus the edge every target on this canvas
					     carries: white@40 (3.79:1) normally, full white when selected. -->
					<g
						role="button"
						tabindex="0"
						aria-label={stageName}
						aria-pressed={c.stageSelected}
						class="group cursor-move outline-none"
						transform="translate({c.px(c.stage.position.x)} {c.py(c.stage.position.y)})"
						onpointerdown={(event) => c.onStagePointerDown(event)}
						onkeydown={(event) => c.onElementKeydown(event, { kind: 'stage' })}
					>
						<title>{stageName}</title>
						{#if c.stage.shape}
							<polygon
								points={c.stage.shape.map((p) => `${p.x * CELL},${p.y * CELL}`).join(' ')}
								class="fill-poster-white/[0.14] {edgeClass(c.stageSelected)}"
								stroke-width={c.stageSelected ? 2.5 : 1.5}
							/>
						{:else}
							<rect
								x={-DEFAULT_STAGE_HALF * CELL}
								y={-0.75 * CELL}
								width={DEFAULT_STAGE_HALF * 2 * CELL}
								height={1.5 * CELL}
								rx={0.75 * CELL}
								class="fill-poster-white/[0.14] {edgeClass(c.stageSelected)}"
								stroke-width={c.stageSelected ? 2.5 : 1.5}
							/>
						{/if}
						<text
							text-anchor="middle"
							dominant-baseline="central"
							class="pointer-events-none fill-poster-white text-[10px] font-extrabold uppercase tracking-[0.2em]"
						>
							{m['seatSelector.stage']()}
						</text>
						<rect
							x={stageFocusBox.x}
							y={stageFocusBox.y}
							width={stageFocusBox.width}
							height={stageFocusBox.height}
							rx="12"
							fill="none"
							stroke-width="2"
							data-testid="designer-focus-ring"
							class="pointer-events-none stroke-poster-amber opacity-0 group-focus-visible:opacity-100"
						/>
						{#if c.stageSelected && c.mode === 'shape'}
							{@render vertexEditor(c.stage.shape, stageName)}
						{/if}
					</g>
				{/if}

				<!-- Onion-skin: the sectors that live on the OTHER floors. Inert and
				     aria-hidden; drawn first so the floor being arranged is on top. -->
				{#each ghostBlocks as block (block.id)}
					{@const t = c.transformOf(block.id)}
					<DesignerGhostBlock
						{block}
						shape={c.shapes.get(block.id) ?? null}
						transform="translate({c.px(t.x)} {c.py(t.y)}) rotate({t.rotation})"
						cell={CELL}
						seatR={SEAT_R}
						label={ghostLabelAt(block)}
					/>
				{/each}

				<!-- Sector blocks (only the active floor's when the venue has floors) -->
				{#each visibleBlocks as block (block.id)}
					{@const t = c.transformOf(block.id)}
					{@const shape = c.shapes.get(block.id) ?? null}
					{@const selected = c.selection?.kind === 'sector' && c.selection.id === block.id}
					{@const labelX = (block.width * CELL) / 2}
					{@const labelNorm = ((t.rotation % 360) + 360) % 360}
					{@const labelFlip = labelNorm > 90 && labelNorm < 270}
					{@const focus = focusBox(shape, {
						x: 0,
						y: 0,
						width: block.width * CELL,
						height: block.height * CELL
					})}
					<g
						data-block-id={block.id}
						role="button"
						tabindex="0"
						aria-label={blockLabel(block)}
						aria-pressed={selected}
						class="group cursor-move outline-none"
						transform="translate({c.px(t.x)} {c.py(t.y)}) rotate({t.rotation})"
						onpointerdown={(event) => c.onBlockPointerDown(event, block)}
						onkeydown={(event) => c.onElementKeydown(event, { kind: 'sector', id: block.id })}
					>
						<title>{blockLabel(block)}</title>
						<!-- Name hugs the sector's top edge and rotates with it; once the
						     block turns past 90° the label flips 180° (about its own centre,
						     so it never drifts) to stay right-side-up. -->
						<text
							x={labelX}
							y={-10}
							text-anchor="middle"
							dominant-baseline="central"
							transform={labelFlip ? `rotate(180 ${labelX} -10)` : undefined}
							class="pointer-events-none text-[11px] font-medium {selected
								? 'fill-poster-white'
								: 'fill-poster-white/80'}"
						>
							{block.name}
						</text>
						<!-- Footprint: a barely-there wash on the house (white@6) so the
						     seats stay the loudest thing in frame, with an edge that is a
						     real UI boundary — white@40, 3.79:1 on ink, going full white
						     (17.40:1) when the block is the selection. A standing zone or
						     any other seatless block keeps its dashed edge on the same
						     wash, which is exactly how the buyer's map draws a zone. -->
						{#if shape && shape.length >= 3}
							<polygon
								points={shape.map((p) => `${p.x * CELL},${p.y * CELL}`).join(' ')}
								class="fill-poster-white/[0.06] {edgeClass(selected)}"
								stroke-width={selected ? 2.5 : 1.5}
							/>
						{:else}
							<rect
								x="0"
								y="0"
								width={block.width * CELL}
								height={block.height * CELL}
								rx="10"
								class="fill-poster-white/[0.06] {edgeClass(selected)}"
								stroke-dasharray={block.hasSeats ? undefined : '6 4'}
								stroke-width={selected ? 2.5 : 1.5}
							/>
						{/if}
						<!-- The shared seat language: one solid dot per seat in its
						     price-category colour, poster Periwinkle (8.36:1 on the house)
						     when the organizer painted none. Category colours are USER
						     DATA and stay inline fills. -->
						{#each block.seats as seat (seat.id)}
							<circle
								cx={(seat.x + 0.5) * CELL}
								cy={(seat.y + 0.5) * CELL}
								r={SEAT_R}
								fill={dotFill(seat.priceCategoryId)}
								class="pointer-events-none"
							/>
						{/each}
						{#if !block.hasSeats && !(shape && shape.length >= 3)}
							<text
								x={(block.width * CELL) / 2}
								y={(block.height * CELL) / 2}
								text-anchor="middle"
								dominant-baseline="central"
								class="pointer-events-none fill-poster-white/80 text-[11px]"
							>
								{m['seatDesigner.noSeats']()}
							</text>
						{/if}
						{#if selected && c.mode === 'arrange'}
							<!-- Rotate handle: a solid white knob on a white@70 stem (8.97:1),
							     the same "white geometry = the thing you are holding" the
							     selection edge and the buyer map's held seat use. -->
							<line
								x1={(block.width * CELL) / 2}
								y1="0"
								x2={(block.width * CELL) / 2}
								y2={-HANDLE_PX}
								class="stroke-poster-white/70"
								stroke-width="1.5"
							/>
							<circle
								aria-hidden="true"
								cx={(block.width * CELL) / 2}
								cy={-HANDLE_PX}
								r="7"
								class="cursor-grab fill-poster-white stroke-poster-ink"
								stroke-width="2"
								onpointerdown={(event) => c.onRotatePointerDown(event, block)}
							>
								<title>{m['seatDesigner.rotateHandle']?.({ name: block.name }) ?? block.name}</title
								>
							</circle>
						{/if}
						{#if selected && c.mode === 'shape'}
							{@render vertexEditor(shape, block.name)}
						{/if}
						<!-- Drawn LAST: a neighbouring block must never paint over the
						     focused block's ring. -->
						<rect
							x={focus.x}
							y={focus.y}
							width={focus.width}
							height={focus.height}
							rx="14"
							fill="none"
							stroke-width="2"
							data-testid="designer-focus-ring"
							class="pointer-events-none stroke-poster-amber opacity-0 group-focus-visible:opacity-100"
						/>
					</g>
				{/each}
			</g>
		</svg>

		<div class="absolute right-2 top-2 flex flex-col gap-1">
			<button
				type="button"
				class={zoomButtonClass}
				aria-label={m['seatMap.zoomIn']()}
				onclick={() => c.vp.zoomBy(1.25)}
			>
				<Plus class="h-4 w-4" aria-hidden="true" />
			</button>
			<button
				type="button"
				class={zoomButtonClass}
				aria-label={m['seatMap.zoomOut']()}
				onclick={() => c.vp.zoomBy(0.8)}
			>
				<Minus class="h-4 w-4" aria-hidden="true" />
			</button>
			<button
				type="button"
				class={zoomButtonClass}
				aria-label={m['seatMap.zoomReset']()}
				onclick={() => c.vp.reset()}
			>
				<RotateCcw class="h-4 w-4" aria-hidden="true" />
			</button>
		</div>
	</div>
</div>
