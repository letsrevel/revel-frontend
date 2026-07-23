/**
 * Interaction controller for the sector-block arranger (runes-in-a-class).
 * Owns editable designer state + pointer/keyboard handlers; pure math lives in
 * designer-interactions. SeatMapDesigner.svelte stays a thin view.
 */
import type { Coordinate2d } from '$lib/api/generated/types.gen';
import { SvelteMap } from 'svelte/reactivity';
import {
	inverseTransform,
	sectorWorldCenter,
	type SectorTransform
} from '$lib/components/tickets/sector-transform';
import {
	blockLocalCenter,
	blockWorldBounds,
	blocksWorldBounds,
	type DesignerBlock,
	type DesignerModel,
	type StageModel
} from './designer-model';
import {
	insertVertex,
	midpoint,
	polygonIsValid,
	removeVertex,
	snapOrRound,
	type Direction
} from './designer-geometry';
import {
	angleFromCenter,
	nudgedPoint,
	nudgedTransform,
	nudgedVertex,
	rotatedTransform,
	translatedPoint,
	translatedTransform
} from './designer-interactions';
import {
	anyShapeChanged,
	anyTransformChanged,
	buildSavePlan,
	stagesEqual,
	type DesignerSavePlan
} from './designer-save';
import { DesignerFloorState } from './designer-floors.svelte';
import { DesignerViewport } from './designer-viewport.svelte';

export const CELL = 32; // px per world unit
export const PAD = 40; // canvas padding (px)
export const WORLD_MARGIN = 12; // breathing room around initial content (units)
export const HANDLE_PX = 30; // rotate-handle offset above a selected block (px)
const ROTATE_KEY_STEP = 15;

export type Selection = { kind: 'sector'; id: string } | { kind: 'stage' };

type Drag =
	| { kind: 'pan'; id: number; moved: boolean; deselectOnUp: boolean }
	| {
			kind: 'move-sector';
			id: number;
			sectorId: string;
			grab: Coordinate2d;
			start: SectorTransform;
	  }
	| { kind: 'move-stage'; id: number; grab: Coordinate2d; start: Coordinate2d }
	| {
			kind: 'rotate';
			id: number;
			sectorId: string;
			center: Coordinate2d;
			localCenter: Coordinate2d;
			startAngle: number;
			startRotation: number;
	  }
	| { kind: 'vertex'; id: number; index: number };

const KEY_DIRECTIONS: Record<string, Direction> = {
	ArrowLeft: 'left',
	ArrowRight: 'right',
	ArrowUp: 'up',
	ArrowDown: 'down'
};

const ZERO_TRANSFORM: SectorTransform = { x: 0, y: 0, rotation: 0 };

const cloneShape = (points: Coordinate2d[] | null): Coordinate2d[] | null =>
	points ? points.map((p) => ({ ...p })) : null;

const cloneStage = (stage: StageModel): StageModel => ({
	position: { ...stage.position },
	shape: cloneShape(stage.shape),
	label: stage.label
});

export class DesignerController {
	readonly vp: DesignerViewport;
	// Editable state, seeded once from the frozen model.
	readonly transforms: SvelteMap<string, SectorTransform>;
	readonly baselineTransforms: SvelteMap<string, SectorTransform>;
	readonly shapes: SvelteMap<string, Coordinate2d[] | null>;
	readonly baselineShapes: SvelteMap<string, Coordinate2d[] | null>;
	stage = $state<StageModel>({ position: { x: 0, y: 0 }, shape: null });
	private baselineStage: StageModel;
	/** Floor plan + per-block assignments (#680); owns its own dirty/baseline. */
	readonly floorState: DesignerFloorState;

	selection = $state<Selection | null>(null);
	mode = $state<'arrange' | 'shape'>('arrange');
	snapOn = $state(true);
	selectedVertex = $state<number | null>(null);
	spaceHeld = $state(false);
	saveIssues = $state<DesignerSavePlan | null>(null);

	private drag: Drag | null = null;
	private readonly pointers = new SvelteMap<number, Coordinate2d>();

	constructor(
		private readonly model: DesignerModel,
		private readonly onSaveFn: (plan: DesignerSavePlan) => Promise<boolean>
	) {
		this.transforms = new SvelteMap(model.blocks.map((b) => [b.id, { ...b.transform }]));
		this.baselineTransforms = new SvelteMap(model.blocks.map((b) => [b.id, { ...b.transform }]));
		this.shapes = new SvelteMap(model.blocks.map((b) => [b.id, cloneShape(b.shape)]));
		this.baselineShapes = new SvelteMap(model.blocks.map((b) => [b.id, cloneShape(b.shape)]));
		this.stage = cloneStage(model.stage);
		this.baselineStage = cloneStage(model.stage);
		this.floorState = new DesignerFloorState(model);
		this.vp = new DesignerViewport({ pad: PAD, offsetY: PAD, cell: CELL }, () => ({
			w: this.contentW,
			h: this.contentH
		}));
	}

	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- derived read-only lookup, never mutated
	readonly blockById = $derived.by(() => new Map(this.model.blocks.map((b) => [b.id, b])));

	/** Fixed world frame from the initial model (stable while dragging). */
	readonly frame = $derived.by(() => {
		const b = blocksWorldBounds(
			this.model.blocks,
			(id) => this.blockById.get(id)?.transform ?? ZERO_TRANSFORM
		);
		const { x: sx, y: sy } = this.model.stage.position;
		const r = 6;
		return {
			minX: Math.min(b.minX, sx - r) - WORLD_MARGIN,
			minY: Math.min(b.minY, sy - r) - WORLD_MARGIN,
			maxX: Math.max(b.maxX, sx + r) + WORLD_MARGIN,
			maxY: Math.max(b.maxY, sy + r) + WORLD_MARGIN
		};
	});
	readonly contentW = $derived((this.frame.maxX - this.frame.minX) * CELL + PAD * 2);
	readonly contentH = $derived((this.frame.maxY - this.frame.minY) * CELL + PAD * 2);

	px(worldX: number): number {
		return PAD + (worldX - this.frame.minX) * CELL;
	}
	py(worldY: number): number {
		return PAD + (worldY - this.frame.minY) * CELL;
	}
	transformOf(id: string): SectorTransform {
		return this.transforms.get(id) ?? this.blockById.get(id)?.transform ?? ZERO_TRANSFORM;
	}
	worldBoundsOf(block: DesignerBlock) {
		return blockWorldBounds(block, this.transformOf(block.id));
	}

	private clientToWorld(clientX: number, clientY: number): Coordinate2d | null {
		const unit = this.vp.clientToUnit(clientX, clientY);
		return unit ? { x: unit.x + this.frame.minX, y: unit.y + this.frame.minY } : null;
	}

	readonly selectedSectorId = $derived(
		this.selection?.kind === 'sector' ? this.selection.id : null
	);
	readonly stageSelected = $derived(this.selection?.kind === 'stage');
	readonly selectionValue = $derived(this.stageSelected ? 'stage' : (this.selectedSectorId ?? ''));
	readonly selectedPolygon = $derived.by((): Coordinate2d[] | null => {
		if (this.selection?.kind === 'sector') return this.shapes.get(this.selection.id) ?? null;
		if (this.selection?.kind === 'stage') return this.stage.shape;
		return null;
	});
	readonly selectedHasShape = $derived(
		this.selectedPolygon !== null && this.selectedPolygon.length > 0
	);
	readonly shapeInvalid = $derived(
		this.mode === 'shape' && this.selectedPolygon !== null && !polygonIsValid(this.selectedPolygon)
	);
	readonly dirty = $derived.by(() => {
		const t = anyTransformChanged(this.model.blocks, this.transforms, this.baselineTransforms);
		const s = anyShapeChanged(this.model.blocks, this.shapes, this.baselineShapes);
		const st = !stagesEqual(this.stage, this.baselineStage);
		const f = this.floorState.dirty;
		return t || s || st || f;
	});

	selectSector(id: string): void {
		this.selection = { kind: 'sector', id };
		this.mode = 'arrange';
		this.selectedVertex = null;
	}
	selectStage(): void {
		this.selection = { kind: 'stage' };
		this.mode = 'arrange';
		this.selectedVertex = null;
	}
	deselect(): void {
		this.selection = null;
		this.mode = 'arrange';
		this.selectedVertex = null;
	}
	onSelectChange(value: string): void {
		if (value === '') this.deselect();
		else if (value === 'stage') this.selectStage();
		else this.selectSector(value);
	}
	toggleSnap(): void {
		this.snapOn = !this.snapOn;
	}
	setSpaceHeld(held: boolean): void {
		this.spaceHeld = held;
	}

	enterShapeMode(): void {
		if (!this.selection) return;
		this.mode = 'shape';
		this.selectedVertex = null;
	}
	exitShapeMode(): void {
		this.mode = 'arrange';
		this.selectedVertex = null;
	}
	clearShape(): void {
		this.setSelectedPolygon(null);
		this.selectedVertex = null;
	}

	private setSelectedPolygon(points: Coordinate2d[] | null): void {
		if (this.selection?.kind === 'sector') this.shapes.set(this.selection.id, points);
		else if (this.selection?.kind === 'stage') this.stage = { ...this.stage, shape: points };
	}
	private worldToLocal(world: Coordinate2d): Coordinate2d {
		if (this.selection?.kind === 'sector')
			return inverseTransform(world, this.transformOf(this.selection.id));
		if (this.selection?.kind === 'stage')
			return { x: world.x - this.stage.position.x, y: world.y - this.stage.position.y };
		return world;
	}
	private appendVertex(world: Coordinate2d): void {
		const local = snapOrRound(this.worldToLocal(world), this.snapOn);
		const next = [...(this.selectedPolygon ?? []), local];
		this.setSelectedPolygon(next);
		this.selectedVertex = next.length - 1;
	}
	insertOnEdge(index: number): void {
		const poly = this.selectedPolygon;
		if (!poly) return;
		const next = insertVertex(
			poly,
			index + 1,
			midpoint(poly[index], poly[(index + 1) % poly.length])
		);
		this.setSelectedPolygon(next);
		this.selectedVertex = index + 1;
	}
	private isPanGesture(event: PointerEvent): boolean {
		return event.button === 1 || this.spaceHeld;
	}
	onCanvasPointerDown(event: PointerEvent): void {
		this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		if (this.pointers.size >= 2) {
			this.drag = null;
			return;
		}
		if (this.mode === 'shape' && this.selection && !this.isPanGesture(event)) {
			const world = this.clientToWorld(event.clientX, event.clientY);
			if (world) this.appendVertex(world);
			this.vp.svgEl?.setPointerCapture(event.pointerId);
			this.drag = { kind: 'pan', id: event.pointerId, moved: true, deselectOnUp: false };
			return;
		}
		this.drag = {
			kind: 'pan',
			id: event.pointerId,
			moved: false,
			deselectOnUp: !this.isPanGesture(event) && this.selection !== null
		};
		this.vp.svgEl?.setPointerCapture(event.pointerId);
	}
	onBlockPointerDown(event: PointerEvent, block: DesignerBlock): void {
		if (this.isPanGesture(event)) return;
		event.stopPropagation();
		this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		this.selectSector(block.id);
		const world = this.clientToWorld(event.clientX, event.clientY);
		if (!world) return;
		this.drag = {
			kind: 'move-sector',
			id: event.pointerId,
			sectorId: block.id,
			grab: world,
			start: { ...this.transformOf(block.id) }
		};
		this.vp.svgEl?.setPointerCapture(event.pointerId);
	}
	onStagePointerDown(event: PointerEvent): void {
		if (this.isPanGesture(event)) return;
		event.stopPropagation();
		this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		this.selectStage();
		const world = this.clientToWorld(event.clientX, event.clientY);
		if (!world) return;
		this.drag = {
			kind: 'move-stage',
			id: event.pointerId,
			grab: world,
			start: { ...this.stage.position }
		};
		this.vp.svgEl?.setPointerCapture(event.pointerId);
	}
	onRotatePointerDown(event: PointerEvent, block: DesignerBlock): void {
		event.stopPropagation();
		this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		const t = this.transformOf(block.id);
		const center = sectorWorldCenter(t, block.width, block.height);
		const world = this.clientToWorld(event.clientX, event.clientY);
		if (!world) return;
		this.drag = {
			kind: 'rotate',
			id: event.pointerId,
			sectorId: block.id,
			center,
			localCenter: blockLocalCenter(block),
			startAngle: angleFromCenter(center, world),
			startRotation: t.rotation
		};
		this.vp.svgEl?.setPointerCapture(event.pointerId);
	}
	onVertexPointerDown(event: PointerEvent, index: number): void {
		event.stopPropagation();
		this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		this.selectedVertex = index;
		this.drag = { kind: 'vertex', id: event.pointerId, index };
		this.vp.svgEl?.setPointerCapture(event.pointerId);
	}
	onCanvasPointerMove(event: PointerEvent): void {
		const prev = this.pointers.get(event.pointerId);
		if (!prev) return;
		const current = { x: event.clientX, y: event.clientY };
		if (this.pointers.size === 2) {
			const other = [...this.pointers.entries()].find(([id]) => id !== event.pointerId)?.[1];
			if (other) {
				const prevDist = Math.hypot(prev.x - other.x, prev.y - other.y);
				const nextDist = Math.hypot(current.x - other.x, current.y - other.y);
				if (prevDist > 0) {
					const mid = this.vp.clientToView((current.x + other.x) / 2, (current.y + other.y) / 2);
					if (mid) this.vp.zoomAt(mid.x, mid.y, nextDist / prevDist);
				}
			}
			this.pointers.set(event.pointerId, current);
			return;
		}
		if (this.drag && this.drag.id === event.pointerId) this.applyDrag(this.drag, prev, current);
		this.pointers.set(event.pointerId, current);
	}
	private applyDrag(active: Drag, prev: Coordinate2d, current: Coordinate2d): void {
		if (active.kind === 'pan') {
			this.vp.panByClientDelta(current.x - prev.x, current.y - prev.y);
			if (Math.abs(current.x - prev.x) + Math.abs(current.y - prev.y) > 1) active.moved = true;
			return;
		}
		const world = this.clientToWorld(current.x, current.y);
		if (!world) return;
		// Follow the pointer 1:1 mid-drag (snapping here makes the block trail the
		// cursor in steps); snap-to-grid is applied once on release.
		if (active.kind === 'move-sector') {
			this.transforms.set(
				active.sectorId,
				translatedTransform(active.start, active.grab, world, false)
			);
		} else if (active.kind === 'move-stage') {
			this.stage = {
				...this.stage,
				position: translatedPoint(active.start, active.grab, world, false)
			};
		} else if (active.kind === 'rotate') {
			const raw =
				active.startRotation + (angleFromCenter(active.center, world) - active.startAngle);
			this.transforms.set(
				active.sectorId,
				rotatedTransform(active.center, active.localCenter, raw, false)
			);
		} else if (active.kind === 'vertex' && this.selectedPolygon) {
			const local = snapOrRound(this.worldToLocal(world), this.snapOn);
			if (active.index < this.selectedPolygon.length) {
				const next = [...this.selectedPolygon];
				next[active.index] = local;
				this.setSelectedPolygon(next);
			}
		}
	}
	onCanvasPointerEnd(event: PointerEvent): void {
		this.pointers.delete(event.pointerId);
		if (this.drag && this.drag.id === event.pointerId) {
			if (this.snapOn) this.snapDragResult(this.drag);
			if (this.drag.kind === 'pan' && this.drag.deselectOnUp && !this.drag.moved) this.deselect();
			this.drag = null;
		}
	}

	/** Snap the just-finished move/rotate to the grid on release (drop-snap). */
	private snapDragResult(active: Drag): void {
		if (active.kind === 'move-sector') {
			const t = this.transforms.get(active.sectorId);
			if (t)
				this.transforms.set(active.sectorId, { ...t, ...snapOrRound({ x: t.x, y: t.y }, true) });
		} else if (active.kind === 'move-stage') {
			this.stage = { ...this.stage, position: snapOrRound(this.stage.position, true) };
		} else if (active.kind === 'rotate') {
			const t = this.transforms.get(active.sectorId);
			// Re-apply with snap on, pinning the same center so the block stays put.
			if (t)
				this.transforms.set(
					active.sectorId,
					rotatedTransform(active.center, active.localCenter, t.rotation, true)
				);
		}
	}
	private rotateSelectedBy(delta: number): void {
		if (this.selection?.kind !== 'sector') return;
		const block = this.blockById.get(this.selection.id);
		if (!block) return;
		const t = this.transformOf(block.id);
		const center = sectorWorldCenter(t, block.width, block.height);
		this.transforms.set(
			block.id,
			rotatedTransform(center, blockLocalCenter(block), t.rotation + delta, this.snapOn)
		);
	}
	private nudgeSelected(direction: Direction, large: boolean): void {
		if (this.selection?.kind === 'sector') {
			const t = this.transformOf(this.selection.id);
			this.transforms.set(this.selection.id, nudgedTransform(t, direction, this.snapOn, large));
		} else if (this.selection?.kind === 'stage') {
			this.stage = {
				...this.stage,
				position: nudgedPoint(this.stage.position, direction, this.snapOn, large)
			};
		}
	}
	onElementKeydown(event: KeyboardEvent, target: Selection): void {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			if (target.kind === 'sector') this.selectSector(target.id);
			else this.selectStage();
			return;
		}
		if (event.key === 'Escape') {
			this.deselect();
			return;
		}
		const isSelected =
			(target.kind === 'sector' &&
				this.selection?.kind === 'sector' &&
				this.selection.id === target.id) ||
			(target.kind === 'stage' && this.selection?.kind === 'stage');
		if (!isSelected) return;
		if (target.kind === 'sector' && (event.key === '[' || event.key === ',')) {
			event.preventDefault();
			this.rotateSelectedBy(-ROTATE_KEY_STEP);
			return;
		}
		if (target.kind === 'sector' && (event.key === ']' || event.key === '.')) {
			event.preventDefault();
			this.rotateSelectedBy(ROTATE_KEY_STEP);
			return;
		}
		const direction = KEY_DIRECTIONS[event.key];
		if (!direction) return;
		event.preventDefault();
		this.nudgeSelected(direction, event.shiftKey);
	}
	onVertexKeydown(event: KeyboardEvent, index: number): void {
		if (event.key === 'Delete' || event.key === 'Backspace') {
			event.preventDefault();
			if (this.selectedPolygon) this.setSelectedPolygon(removeVertex(this.selectedPolygon, index));
			this.selectedVertex = null;
			return;
		}
		if (event.key === 'Escape') {
			this.exitShapeMode();
			return;
		}
		const direction = KEY_DIRECTIONS[event.key];
		if (!direction || !this.selectedPolygon || index >= this.selectedPolygon.length) return;
		event.preventDefault();
		this.setSelectedPolygon(
			nudgedVertex(this.selectedPolygon, index, direction, this.snapOn, event.shiftKey)
		);
	}

	async save(): Promise<void> {
		const plan = buildSavePlan({
			model: this.model,
			transforms: this.transforms,
			baselineTransforms: this.baselineTransforms,
			shapes: this.shapes,
			baselineShapes: this.baselineShapes,
			stage: this.stage,
			baselineStage: this.baselineStage,
			...this.floorState.saveInput
		});
		if (plan.violations.length > 0 || plan.invalidShapeSectors.length > 0) {
			this.saveIssues = plan;
			return;
		}
		this.saveIssues = null;
		if (plan.isEmpty) return;
		const ok = await this.onSaveFn(plan);
		if (!ok) return;
		for (const [id, t] of this.transforms) this.baselineTransforms.set(id, { ...t });
		for (const [id, s] of this.shapes) this.baselineShapes.set(id, cloneShape(s));
		this.baselineStage = cloneStage(this.stage);
		this.floorState.commitBaseline();
	}
}
