/**
 * Save-plan builder for the sector-block arranger (pure, unit-testable).
 *
 * Turns the designer's edited state into the write payloads the backend
 * expects, WITHOUT ever moving seats:
 *
 * - For each CHANGED sector, one sector PUT carrying `metadata` (the sector's
 *   existing blob with `transform` merged in — `aisles` and any other keys are
 *   preserved) and/or `shape` (the outline mapped back into the persisted frame,
 *   or null to clear it).
 * - When the stage changed, one venue PUT carrying `metadata` (the venue's
 *   existing blob with `stage` merged in).
 *
 * A sector whose outline changed is pre-validated: the polygon must have ≥3
 * valid vertices (else `invalidShapeSectors`), and — only for sectors whose
 * seats already have stored positions — every seat must fall inside the new
 * outline (else `violations`), mirroring the atomic 400 the backend returns.
 */
import type { Coordinate2d } from '$lib/api/generated/types.gen';
import { extractApiErrorDetail } from '$lib/utils/api-error-detail';
import type { SectorTransform } from '$lib/components/tickets/sector-transform';
import { pointInPolygon, polygonIsValid, roundCoord, shapesEqual } from './designer-geometry';
import type { DesignerBlock, DesignerModel, StageModel } from './designer-model';

/** Per-axis tolerance below which a transform/position counts as unchanged. */
export const TRANSFORM_EPSILON = 1e-3;

export interface SectorUpdate {
	sectorId: string;
	sectorName: string;
	/** Merged sector metadata (existing blob + transform); undefined when unchanged. */
	metadata?: Record<string, unknown>;
	/** Persist-frame outline, or null to clear; undefined when the outline is unchanged. */
	shape?: Coordinate2d[] | null;
}

export interface StageUpdate {
	/** Merged venue metadata (existing blob + stage). */
	metadata: Record<string, unknown>;
}

export interface ShapeViolation {
	sectorId: string;
	sectorName: string;
	seatLabels: string[];
}

export interface InvalidShapeSector {
	sectorId: string;
	sectorName: string;
}

export interface DesignerSavePlan {
	sectorUpdates: SectorUpdate[];
	stageUpdate: StageUpdate | null;
	/** Sectors whose writes were withheld because seats fall outside the outline. */
	violations: ShapeViolation[];
	/** Sectors whose edited outline has fewer than 3 (or degenerate) vertices. */
	invalidShapeSectors: InvalidShapeSector[];
	isEmpty: boolean;
}

export function transformsEqual(
	a: SectorTransform,
	b: SectorTransform,
	epsilon = TRANSFORM_EPSILON
): boolean {
	return (
		Math.abs(a.x - b.x) <= epsilon &&
		Math.abs(a.y - b.y) <= epsilon &&
		Math.abs(a.rotation - b.rotation) <= epsilon
	);
}

export function stagesEqual(a: StageModel, b: StageModel, epsilon = TRANSFORM_EPSILON): boolean {
	if (Math.abs(a.position.x - b.position.x) > epsilon) return false;
	if (Math.abs(a.position.y - b.position.y) > epsilon) return false;
	if ((a.label ?? '') !== (b.label ?? '')) return false;
	return shapesEqual(a.shape, b.shape, epsilon);
}

/** Merge a transform into a sector's metadata blob without disturbing other keys. */
export function mergeTransformIntoMetadata(
	metadata: Record<string, unknown> | null,
	transform: SectorTransform
): Record<string, unknown> {
	return {
		...(metadata ?? {}),
		transform: {
			x: roundCoord(transform.x),
			y: roundCoord(transform.y),
			rotation: roundCoord(transform.rotation)
		}
	};
}

/** Serialize a stage into the venue-metadata `stage` value. */
export function serializeStage(stage: StageModel): Record<string, unknown> {
	const value: Record<string, unknown> = {
		position: { x: roundCoord(stage.position.x), y: roundCoord(stage.position.y) },
		shape: stage.shape ? stage.shape.map((p) => ({ x: roundCoord(p.x), y: roundCoord(p.y) })) : null
	};
	if (stage.label) value.label = stage.label;
	return value;
}

/** Merge a stage into the venue metadata blob without disturbing other keys. */
export function mergeStageIntoMetadata(
	metadata: Record<string, unknown> | null,
	stage: StageModel
): Record<string, unknown> {
	return { ...(metadata ?? {}), stage: serializeStage(stage) };
}

/** Map an edited local outline into the sector's persisted frame. */
function toPersistedShape(local: Coordinate2d[], block: DesignerBlock): Coordinate2d[] {
	return local.map((p) => ({
		x: roundCoord(p.x + block.shapeFrameOffset.x),
		y: roundCoord(p.y + block.shapeFrameOffset.y)
	}));
}

export interface SavePlanInput {
	model: DesignerModel;
	/** Current world placements, keyed by sector id (covers every block). */
	transforms: ReadonlyMap<string, SectorTransform>;
	baselineTransforms: ReadonlyMap<string, SectorTransform>;
	/** Current LOCAL outlines (null = no outline), keyed by sector id. */
	shapes: ReadonlyMap<string, Coordinate2d[] | null>;
	baselineShapes: ReadonlyMap<string, Coordinate2d[] | null>;
	stage: StageModel;
	baselineStage: StageModel;
}

export function buildSavePlan(input: SavePlanInput): DesignerSavePlan {
	const { model, transforms, baselineTransforms, shapes, baselineShapes, stage, baselineStage } =
		input;

	const sectorUpdates: SectorUpdate[] = [];
	const violations: ShapeViolation[] = [];
	const invalidShapeSectors: InvalidShapeSector[] = [];

	for (const block of model.blocks) {
		const transform = transforms.get(block.id) ?? block.transform;
		const baseTransform = baselineTransforms.get(block.id) ?? block.transform;
		const transformChanged = !transformsEqual(transform, baseTransform);

		const shape = shapes.get(block.id) ?? null;
		const baseShape = baselineShapes.get(block.id) ?? null;
		const shapeChanged = !shapesEqual(shape, baseShape);

		if (!transformChanged && !shapeChanged) continue;

		if (shapeChanged && shape && !polygonIsValid(shape)) {
			invalidShapeSectors.push({ sectorId: block.id, sectorName: block.name });
			continue;
		}

		// A shrunk outline can strand seats the backend already knows the position
		// of; guard those exactly as the backend would (grid-only sectors have no
		// stored positions, so the backend cannot validate them — skip the guard).
		if (shapeChanged && shape && block.hasCompletePositions) {
			const offending = block.seats.filter((seat) => !pointInPolygon(seat, shape));
			if (offending.length > 0) {
				violations.push({
					sectorId: block.id,
					sectorName: block.name,
					seatLabels: offending.map((seat) => seat.label)
				});
				continue;
			}
		}

		const update: SectorUpdate = { sectorId: block.id, sectorName: block.name };
		if (transformChanged) {
			update.metadata = mergeTransformIntoMetadata(block.metadata, transform);
		}
		if (shapeChanged) {
			update.shape = shape ? toPersistedShape(shape, block) : null;
		}
		sectorUpdates.push(update);
	}

	const stageChanged = !stagesEqual(stage, baselineStage);
	const stageUpdate: StageUpdate | null = stageChanged
		? { metadata: mergeStageIntoMetadata(model.venueMetadata, stage) }
		: null;

	return {
		sectorUpdates,
		stageUpdate,
		violations,
		invalidShapeSectors,
		isEmpty:
			sectorUpdates.length === 0 &&
			stageUpdate === null &&
			violations.length === 0 &&
			invalidShapeSectors.length === 0
	};
}

/** True when any block's transform differs from its baseline. */
export function anyTransformChanged(
	blocks: readonly Pick<DesignerBlock, 'id' | 'transform'>[],
	transforms: ReadonlyMap<string, SectorTransform>,
	baselineTransforms: ReadonlyMap<string, SectorTransform>
): boolean {
	return blocks.some(
		(block) =>
			!transformsEqual(
				transforms.get(block.id) ?? block.transform,
				baselineTransforms.get(block.id) ?? block.transform
			)
	);
}

/** True when any block's outline differs from its baseline. */
export function anyShapeChanged(
	blocks: readonly Pick<DesignerBlock, 'id'>[],
	shapes: ReadonlyMap<string, Coordinate2d[] | null>,
	baselineShapes: ReadonlyMap<string, Coordinate2d[] | null>
): boolean {
	return blocks.some(
		(block) => !shapesEqual(shapes.get(block.id) ?? null, baselineShapes.get(block.id) ?? null)
	);
}

/** Human-readable message for a failed sector update. */
export function sectorUpdateErrorMessage(
	error: unknown,
	update: Pick<SectorUpdate, 'sectorName'>,
	fallback: string
): string {
	const detail = extractApiErrorDetail(error);
	return `${update.sectorName}: ${detail ?? fallback}`;
}

/** Human-readable message for a failed venue (stage) update. */
export function stageUpdateErrorMessage(error: unknown, fallback: string): string {
	const detail = extractApiErrorDetail(error);
	return detail ?? fallback;
}
