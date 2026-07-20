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
	 */
	import * as m from '$lib/paraglide/messages.js';
	import type { Coordinate2d } from '$lib/api/generated/types.gen';
	import { Minus, Plus, RotateCcw } from '@lucide/svelte';
	import DesignerToolbar from './DesignerToolbar.svelte';
	import { CELL, HANDLE_PX, DesignerController } from './designer-controller.svelte';
	import { midpoint } from './designer-geometry';
	import type { DesignerBlock, DesignerModel } from './designer-model';
	import type { DesignerSavePlan } from './designer-save';

	interface Props {
		model: DesignerModel;
		isSaving: boolean;
		/** Persist the plan; resolve true when everything was written. */
		onSave: (plan: DesignerSavePlan) => Promise<boolean>;
		onDirtyChange?: (dirty: boolean) => void;
		/** Link target for a sector's grid editor. */
		sectorEditorHref: (sectorId: string) => string;
	}

	const { model, isSaving, onSave, onDirtyChange, sectorEditorHref }: Props = $props();

	const uid = $props.id();
	// The route freezes `model` on first load and `onSave` is stable, so capturing
	// them once in the controller is intentional.
	// svelte-ignore state_referenced_locally
	const c = new DesignerController(model, onSave);

	$effect(() => {
		onDirtyChange?.(c.dirty);
	});

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

	const zoomButtonClass =
		'flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background/90 ' +
		'text-foreground shadow-sm transition-colors hover:bg-muted ' +
		'[@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11';
</script>

<svelte:window onkeydown={onWindowKeydown} onkeyup={onWindowKeyup} />

{#snippet vertexEditor(points: Coordinate2d[] | null, name: string)}
	{#if points}
		{#if points.length >= 2}
			{#each points as vertex, index (index)}
				{@const mid = midpoint(vertex, points[(index + 1) % points.length])}
				<circle
					role="button"
					tabindex="0"
					aria-label={m['seatDesigner.addVertex']?.() ?? 'Add shape point'}
					cx={mid.x * CELL}
					cy={mid.y * CELL}
					r="4"
					class="cursor-copy fill-background stroke-primary/60 outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
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
			{/each}
		{/if}
		{#each points as vertex, index (index)}
			<circle
				role="button"
				tabindex="0"
				aria-label={vertexLabel(index, name)}
				cx={vertex.x * CELL}
				cy={vertex.y * CELL}
				r="6"
				class="cursor-move outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring {index ===
				c.selectedVertex
					? 'fill-primary stroke-primary-foreground'
					: 'fill-background stroke-primary'}"
				stroke-width="2"
				onpointerdown={(event) => c.onVertexPointerDown(event, index)}
				onkeydown={(event) => c.onVertexKeydown(event, index)}
			/>
		{/each}
	{/if}
{/snippet}

<div class="space-y-4">
	<DesignerToolbar
		blocks={model.blocks}
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

	<div class="relative overflow-hidden rounded-lg border bg-card">
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
				<!-- Stage -->
				<g
					role="button"
					tabindex="0"
					aria-label={stageName}
					aria-pressed={c.stageSelected}
					class="cursor-move outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
					transform="translate({c.px(c.stage.position.x)} {c.py(c.stage.position.y)})"
					onpointerdown={(event) => c.onStagePointerDown(event)}
					onkeydown={(event) => c.onElementKeydown(event, { kind: 'stage' })}
				>
					<title>{stageName}</title>
					{#if c.stage.shape}
						<polygon
							points={c.stage.shape.map((p) => `${p.x * CELL},${p.y * CELL}`).join(' ')}
							class="fill-muted {c.stageSelected ? 'stroke-primary' : 'stroke-border'}"
							stroke-width={c.stageSelected ? 2.5 : 1.5}
						/>
					{:else}
						<rect
							x={-DEFAULT_STAGE_HALF * CELL}
							y={-0.75 * CELL}
							width={DEFAULT_STAGE_HALF * 2 * CELL}
							height={1.5 * CELL}
							rx="8"
							class="fill-muted {c.stageSelected ? 'stroke-primary' : 'stroke-border'}"
							stroke-width={c.stageSelected ? 2.5 : 1.5}
						/>
					{/if}
					<text
						text-anchor="middle"
						dominant-baseline="central"
						class="pointer-events-none fill-muted-foreground text-[11px] font-medium tracking-widest"
					>
						{m['seatSelector.stage']()}
					</text>
					{#if c.stageSelected && c.mode === 'shape'}
						{@render vertexEditor(c.stage.shape, stageName)}
					{/if}
				</g>

				<!-- Sector blocks -->
				{#each model.blocks as block (block.id)}
					{@const t = c.transformOf(block.id)}
					{@const shape = c.shapes.get(block.id) ?? null}
					{@const selected = c.selection?.kind === 'sector' && c.selection.id === block.id}
					{@const labelX = (block.width * CELL) / 2}
					{@const labelNorm = ((t.rotation % 360) + 360) % 360}
					{@const labelFlip = labelNorm > 90 && labelNorm < 270}
					<g
						data-block-id={block.id}
						role="button"
						tabindex="0"
						aria-label={blockLabel(block)}
						aria-pressed={selected}
						class="cursor-move outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
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
								? 'fill-primary'
								: 'fill-muted-foreground'}"
						>
							{block.name}
						</text>
						{#if shape && shape.length >= 3}
							<polygon
								points={shape.map((p) => `${p.x * CELL},${p.y * CELL}`).join(' ')}
								class="fill-muted/30 {selected ? 'stroke-primary' : 'stroke-border/70'}"
								stroke-width={selected ? 2 : 1.25}
							/>
						{:else}
							<rect
								x="0"
								y="0"
								width={block.width * CELL}
								height={block.height * CELL}
								rx="10"
								class="fill-muted/20 {selected ? 'stroke-primary' : 'stroke-border/60'}"
								stroke-dasharray={block.hasSeats ? undefined : '6 4'}
								stroke-width={selected ? 2 : 1.25}
							/>
						{/if}
						{#each block.seats as seat (seat.id)}
							<circle
								cx={(seat.x + 0.5) * CELL}
								cy={(seat.y + 0.5) * CELL}
								r="4"
								class="pointer-events-none fill-background stroke-border"
								stroke-width="1"
							/>
						{/each}
						{#if !block.hasSeats && !(shape && shape.length >= 3)}
							<text
								x={(block.width * CELL) / 2}
								y={(block.height * CELL) / 2}
								text-anchor="middle"
								dominant-baseline="central"
								class="pointer-events-none fill-muted-foreground text-[11px]"
							>
								{m['seatDesigner.noSeats']()}
							</text>
						{/if}
						{#if selected && c.mode === 'arrange'}
							<line
								x1={(block.width * CELL) / 2}
								y1="0"
								x2={(block.width * CELL) / 2}
								y2={-HANDLE_PX}
								class="stroke-primary"
								stroke-width="1.5"
							/>
							<circle
								aria-hidden="true"
								cx={(block.width * CELL) / 2}
								cy={-HANDLE_PX}
								r="7"
								class="cursor-grab fill-background stroke-primary"
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
