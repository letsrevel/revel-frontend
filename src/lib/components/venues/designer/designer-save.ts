/**
 * Save-plan builder for the freeform designer (pure, unit-testable).
 *
 * Turns the designer's edited state (global seat positions + global sector
 * shapes) into the exact write payloads the backend expects:
 *
 * - Seat positions go through the per-sector bulk-update endpoint, identified
 *   by label, only for CHANGED seats — except in sectors that did not yet have
 *   complete positions, where the first position write materializes ALL active
 *   seats (the public map's position passthrough only kicks in when every seat
 *   of a sector has a position).
 * - Shapes go through the sector update endpoint ({shape} partial update).
 *   Shape updates must be applied BEFORE seat batches so seat writes validate
 *   against the new polygon.
 * - Containment is pre-validated with the backend's own point-in-polygon
 *   algorithm; offending sectors produce `violations` (with the seats listed)
 *   and get NO writes, mirroring the atomic 400 the backend would return.
 */
import type { Coordinate2d, VenueSeatBulkUpdateItemSchema } from '$lib/api/generated/types.gen';
import { extractApiErrorDetail } from '$lib/utils/api-error-detail';
import { pointInPolygon, polygonIsValid, shapesEqual } from './designer-geometry';
import { toPersistFrame, type DesignerModel, type DesignerSector } from './designer-model';

/** Positions closer than this (per axis) count as unchanged. */
export const POSITION_EPSILON = 1e-3;

/** Seats per bulk-update request. */
export const SEAT_BATCH_SIZE = 200;

export interface SeatBatch {
	sectorId: string;
	sectorName: string;
	seats: VenueSeatBulkUpdateItemSchema[];
}

export interface ShapeUpdate {
	sectorId: string;
	sectorName: string;
	/** Persist-frame polygon, or null to clear the shape. */
	shape: Coordinate2d[] | null;
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
	/** Apply first (seat writes validate against the stored shape). */
	shapeUpdates: ShapeUpdate[];
	seatBatches: SeatBatch[];
	/** Sectors whose writes were withheld because seats fall outside the shape. */
	violations: ShapeViolation[];
	/** Sectors whose edited shape has fewer than 3 vertices (or is degenerate). */
	invalidShapeSectors: InvalidShapeSector[];
	isEmpty: boolean;
}

export function positionsDiffer(
	a: Coordinate2d | undefined,
	b: Coordinate2d | undefined,
	epsilon = POSITION_EPSILON
): boolean {
	if (!a || !b) return Boolean(a) !== Boolean(b);
	return Math.abs(a.x - b.x) > epsilon || Math.abs(a.y - b.y) > epsilon;
}

function chunk<T>(items: T[], size: number): T[][] {
	const chunks: T[][] = [];
	for (let i = 0; i < items.length; i += size) {
		chunks.push(items.slice(i, i + size));
	}
	return chunks;
}

export interface SavePlanInput {
	model: DesignerModel;
	/** Current global seat positions, keyed by seat id (must cover all seats). */
	positions: ReadonlyMap<string, Coordinate2d>;
	baselinePositions: ReadonlyMap<string, Coordinate2d>;
	/** Current global sector shapes (null = no shape), keyed by sector id. */
	shapes: ReadonlyMap<string, Coordinate2d[] | null>;
	baselineShapes: ReadonlyMap<string, Coordinate2d[] | null>;
	batchSize?: number;
}

export function buildSavePlan(input: SavePlanInput): DesignerSavePlan {
	const { model, positions, baselinePositions, shapes, baselineShapes } = input;
	const batchSize = input.batchSize ?? SEAT_BATCH_SIZE;

	const shapeUpdates: ShapeUpdate[] = [];
	const seatBatches: SeatBatch[] = [];
	const violations: ShapeViolation[] = [];
	const invalidShapeSectors: InvalidShapeSector[] = [];

	for (const sector of model.sectors) {
		const currentShape = shapes.get(sector.id) ?? null;
		const baseShape = baselineShapes.get(sector.id) ?? null;
		const shapeChanged = !shapesEqual(currentShape, baseShape);

		if (shapeChanged && currentShape && !polygonIsValid(currentShape)) {
			invalidShapeSectors.push({ sectorId: sector.id, sectorName: sector.name });
			continue;
		}

		const sectorSeats = model.seats.filter((seat) => seat.sectorId === sector.id);
		const changed = sectorSeats.filter((seat) =>
			positionsDiffer(positions.get(seat.id), baselinePositions.get(seat.id))
		);
		// Materialize the whole sector on the first position write, otherwise the
		// public map keeps falling back to the derived grid (position passthrough
		// requires every seat to have one).
		const writeSeats = changed.length > 0 && !sector.hasCompletePositions ? sectorSeats : changed;

		// Pre-validate containment against the *edited* shape. When the shape
		// itself changed, every seat of the sector must fit (a shape that
		// strands unwritten seats would make all future seat writes 400).
		if (currentShape) {
			const toCheck = shapeChanged ? sectorSeats : writeSeats;
			const offending = toCheck.filter((seat) => {
				const position = positions.get(seat.id);
				return position !== undefined && !pointInPolygon(position, currentShape);
			});
			if (offending.length > 0) {
				violations.push({
					sectorId: sector.id,
					sectorName: sector.name,
					seatLabels: offending.map((seat) => seat.label)
				});
				continue;
			}
		}

		if (shapeChanged) {
			shapeUpdates.push({
				sectorId: sector.id,
				sectorName: sector.name,
				shape: currentShape ? currentShape.map((p) => toPersistFrame(p, sector)) : null
			});
		}

		if (writeSeats.length > 0) {
			const items: VenueSeatBulkUpdateItemSchema[] = writeSeats.map((seat) => {
				const position = positions.get(seat.id) ?? { x: seat.x, y: seat.y };
				return { label: seat.label, position: toPersistFrame(position, sector) };
			});
			for (const seats of chunk(items, batchSize)) {
				seatBatches.push({ sectorId: sector.id, sectorName: sector.name, seats });
			}
		}
	}

	return {
		shapeUpdates,
		seatBatches,
		violations,
		invalidShapeSectors,
		isEmpty:
			shapeUpdates.length === 0 &&
			seatBatches.length === 0 &&
			violations.length === 0 &&
			invalidShapeSectors.length === 0
	};
}

/** Count of seats whose current position differs from the baseline. */
export function countChangedSeats(
	model: DesignerModel,
	positions: ReadonlyMap<string, Coordinate2d>,
	baselinePositions: ReadonlyMap<string, Coordinate2d>
): number {
	let count = 0;
	for (const seat of model.seats) {
		if (positionsDiffer(positions.get(seat.id), baselinePositions.get(seat.id))) count++;
	}
	return count;
}

/** True when any sector's shape differs from its baseline. */
export function anyShapeChanged(
	sectors: readonly Pick<DesignerSector, 'id'>[],
	shapes: ReadonlyMap<string, Coordinate2d[] | null>,
	baselineShapes: ReadonlyMap<string, Coordinate2d[] | null>
): boolean {
	return sectors.some(
		(sector) => !shapesEqual(shapes.get(sector.id) ?? null, baselineShapes.get(sector.id) ?? null)
	);
}

/**
 * Human-readable message for a failed seat batch: the backend's detail (it
 * names the first offending seat) when present, otherwise the fallback with
 * the batch's seat labels listed.
 */
export function seatBatchErrorMessage(error: unknown, batch: SeatBatch, fallback: string): string {
	const detail = extractApiErrorDetail(error);
	if (detail) return `${batch.sectorName}: ${detail}`;
	const labels = batch.seats.map((seat) => seat.label).join(', ');
	return `${batch.sectorName}: ${fallback} (${labels})`;
}

/** Human-readable message for a failed sector shape update. */
export function shapeUpdateErrorMessage(
	error: unknown,
	update: ShapeUpdate,
	fallback: string
): string {
	const detail = extractApiErrorDetail(error);
	return `${update.sectorName}: ${detail ?? fallback}`;
}
