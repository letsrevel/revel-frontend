/**
 * Designer scene model (v2 — sector-block arranger + stage).
 *
 * The designer arranges whole sectors as rigid BLOCKS on a venue floor plan and
 * places/shapes the stage — it never moves individual seats (seat-by-seat
 * layout stays in the grid editor). To guarantee the designer canvas and the
 * buyer-facing seat map agree pixel-for-pixel, every block's LOCAL geometry
 * (seat dots, outline shape, size) and its initial placement come straight from
 * `computeSeatMapLayout` — the exact same pure layer `SeatMap.svelte` renders.
 * Editing writes only the block's `SectorTransform` (world placement) and its
 * outline `shape`; seats keep their sector-local positions.
 *
 * Two extra pieces the buyer layer does not need are computed here:
 * - `shapeFrameOffset` per block — the translation from the normalized local
 *   frame back to the sector's PERSISTED frame, so an edited outline saves into
 *   the same coordinate space the backend (and the buyer) expect
 *   (`persisted = local + shapeFrameOffset`).
 * - the `stage` — read from `Venue.metadata.stage`, or a sensible default (a
 *   wide bar centered above the blocks' world bounding box) when none is stored.
 */
import type {
	ChartSectorSchema,
	Coordinate2d,
	VenueSectorWithSeatsSchema
} from '$lib/api/generated/types.gen';
import { computeSeatMapLayout } from '$lib/components/tickets/seat-map-layout';
import { applyTransform, type SectorTransform } from '$lib/components/tickets/sector-transform';
import { explicitFloorId, parseFloors, type VenueFloor } from '../venue-floors';

/** A seat dot in a block's LOCAL frame (1 unit = one seat cell). */
export interface DesignerSeatDot {
	id: string;
	label: string;
	x: number;
	y: number;
}

/** A sector rendered as a rigid, movable/rotatable block. */
export interface DesignerBlock {
	id: string;
	name: string;
	kind: 'seated' | 'standing';
	/** Seat dots in the block's local frame (never edited by the designer). */
	seats: DesignerSeatDot[];
	/** Outline polygon in the block's local frame; null when the sector has none. */
	shape: Coordinate2d[] | null;
	/** Local frame size (units) — the block spans local [0,width] × [0,height]. */
	width: number;
	height: number;
	/** Initial world placement (parsed metadata.transform, or stacked default). */
	transform: SectorTransform;
	/** local → persisted frame translation for saving the outline shape. */
	shapeFrameOffset: Coordinate2d;
	/** The sector's existing metadata blob, preserved on save (aisles etc.). */
	metadata: Record<string, unknown> | null;
	/**
	 * EXPLICIT floor assignment (`metadata.floor` naming a known floor id), or
	 * null — implicitly the first floor by convention; nothing is written until
	 * the block is deliberately moved.
	 */
	floorId: string | null;
	/** True when the sector has at least one active seat. */
	hasSeats: boolean;
	/**
	 * True when every active seat already has a stored position. Only then does
	 * the backend validate seats against a changed outline, so only then does the
	 * save guard pre-check containment.
	 */
	hasCompletePositions: boolean;
}

/** The venue stage: a positionable, shapeable element in world coordinates. */
export interface StageModel {
	/** World position of the stage's local origin (its shape's center). */
	position: Coordinate2d;
	/** Outline polygon LOCAL to `position` (vertices around the origin); null = default bar. */
	shape: Coordinate2d[] | null;
	label?: string;
}

export interface DesignerModel {
	blocks: DesignerBlock[];
	stage: StageModel;
	/** The venue's existing metadata blob, preserved on save (merge stage into it). */
	venueMetadata: Record<string, unknown> | null;
	/** Ordered floor plan from `venue.metadata.floors`; [] = flattened plane. */
	floors: VenueFloor[];
}

/** Units of clear space between the blocks' bounding box and a default stage. */
export const STAGE_GAP = 3;
/** Default stage bar half-height (units). */
const STAGE_HALF_HEIGHT = 0.75;

function collate(a: string, b: string): number {
	return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function asMetadata(value: unknown): Record<string, unknown> | null {
	return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

/** Map an admin sector (with seats) into the buyer chart-sector shape. */
function toChartSector(sector: VenueSectorWithSeatsSchema & { id: string }): ChartSectorSchema {
	return {
		id: sector.id,
		name: sector.name,
		kind: sector.kind ?? 'seated',
		shape: sector.shape ?? null,
		capacity: sector.capacity ?? null,
		display_order: sector.display_order ?? 0,
		metadata: sector.metadata ?? null,
		seats: (sector.seats ?? [])
			.filter((seat): seat is typeof seat & { id: string } => typeof seat.id === 'string')
			.map((seat) => ({
				id: seat.id,
				label: seat.label,
				row_label: seat.row_label ?? seat.row ?? null,
				number: seat.number ?? null,
				position: seat.position ?? null,
				is_active: seat.is_active,
				price_category_id: seat.price_category_id ?? null
			}))
	};
}

/**
 * The translation from a sector's normalized local frame back to its persisted
 * frame, matching `seat-map-layout`'s normalization:
 * - complete seat positions → shared minimum over seat positions ∪ shape;
 * - otherwise (grid-derived) → the shape's own bounding-box minimum (seats have
 *   no stored frame), or the origin when there is no shape.
 */
function computeShapeFrameOffset(
	sector: VenueSectorWithSeatsSchema,
	rawShape: Coordinate2d[] | null
): Coordinate2d {
	const active = (sector.seats ?? []).filter((seat) => seat.is_active !== false);
	const complete = active.length > 0 && active.every((seat) => Boolean(seat.position));
	if (complete) {
		const frame: Coordinate2d[] = [...active.map((seat) => seat.position as Coordinate2d)];
		if (rawShape) frame.push(...rawShape);
		return { x: Math.min(...frame.map((p) => p.x)), y: Math.min(...frame.map((p) => p.y)) };
	}
	if (rawShape) {
		return { x: Math.min(...rawShape.map((p) => p.x)), y: Math.min(...rawShape.map((p) => p.y)) };
	}
	return { x: 0, y: 0 };
}

/** World-space AABB of a block's local [0,width]×[0,height] frame under a transform. */
export function blockWorldBounds(
	block: Pick<DesignerBlock, 'width' | 'height'>,
	transform: SectorTransform
): { minX: number; minY: number; maxX: number; maxY: number } {
	const corners = [
		{ x: 0, y: 0 },
		{ x: block.width, y: 0 },
		{ x: block.width, y: block.height },
		{ x: 0, y: block.height }
	].map((corner) => applyTransform(corner, transform));
	const xs = corners.map((c) => c.x);
	const ys = corners.map((c) => c.y);
	return {
		minX: Math.min(...xs),
		minY: Math.min(...ys),
		maxX: Math.max(...xs),
		maxY: Math.max(...ys)
	};
}

/** Union of every block's world AABB (empty → a unit box at the origin). */
export function blocksWorldBounds(
	blocks: readonly DesignerBlock[],
	transformOf: (id: string) => SectorTransform
): { minX: number; minY: number; maxX: number; maxY: number } {
	if (blocks.length === 0) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const block of blocks) {
		const b = blockWorldBounds(block, transformOf(block.id));
		minX = Math.min(minX, b.minX);
		minY = Math.min(minY, b.minY);
		maxX = Math.max(maxX, b.maxX);
		maxY = Math.max(maxY, b.maxY);
	}
	return { minX, minY, maxX, maxY };
}

/** Defensive parse of `Venue.metadata.stage`; null when absent or malformed. */
export function parseStage(
	metadata: Record<string, unknown> | null | undefined
): StageModel | null {
	const raw = asMetadata(metadata?.stage);
	if (!raw) return null;
	const position = asMetadata(raw.position);
	const px = position?.x;
	const py = position?.y;
	if (typeof px !== 'number' || !Number.isFinite(px)) return null;
	if (typeof py !== 'number' || !Number.isFinite(py)) return null;
	let shape: Coordinate2d[] | null = null;
	if (Array.isArray(raw.shape)) {
		const points = raw.shape
			.map(asMetadata)
			.filter((p): p is Record<string, unknown> => p !== null)
			.filter((p) => typeof p.x === 'number' && typeof p.y === 'number')
			.map((p) => ({ x: p.x as number, y: p.y as number }));
		shape = points.length >= 3 ? points : null;
	}
	const label = typeof raw.label === 'string' ? raw.label : undefined;
	return { position: { x: px, y: py }, shape, label };
}

/** A default stage: a wide bar centered above the blocks' world bounding box. */
export function defaultStage(blocks: readonly DesignerBlock[]): StageModel {
	const bounds = blocksWorldBounds(blocks, (id) => {
		const block = blocks.find((b) => b.id === id);
		return block?.transform ?? { x: 0, y: 0, rotation: 0 };
	});
	const spanX = Math.max(bounds.maxX - bounds.minX, 4);
	const halfWidth = Math.max(2, Math.min(spanX * 0.4, 10));
	const shape: Coordinate2d[] = [
		{ x: -halfWidth, y: -STAGE_HALF_HEIGHT },
		{ x: halfWidth, y: -STAGE_HALF_HEIGHT },
		{ x: halfWidth, y: STAGE_HALF_HEIGHT },
		{ x: -halfWidth, y: STAGE_HALF_HEIGHT }
	];
	return {
		position: {
			x: (bounds.minX + bounds.maxX) / 2,
			y: bounds.minY - STAGE_GAP - STAGE_HALF_HEIGHT
		},
		shape
	};
}

/**
 * Build the designer model from the admin sector list (with seats) and the
 * venue metadata. Local geometry and initial transforms come from
 * `computeSeatMapLayout` (so the canvas matches the buyer map); the stage comes
 * from `venue.metadata.stage` or a default centered above the blocks.
 */
export function buildDesignerModel(
	rawSectors: VenueSectorWithSeatsSchema[],
	venueMetadata: Record<string, unknown> | null | undefined
): DesignerModel {
	const withIds = rawSectors.filter(
		(sector): sector is VenueSectorWithSeatsSchema & { id: string } => typeof sector.id === 'string'
	);
	const floors = parseFloors(venueMetadata);
	const layout = computeSeatMapLayout({
		venue_id: '',
		venue_name: '',
		updated_at: '',
		sectors: withIds.map(toChartSector)
	});
	const rawById = new Map(withIds.map((s) => [s.id, s]));

	const blocks: DesignerBlock[] = [];
	for (const laid of [...layout.sectors].sort((a, b) => collate(a.name, b.name))) {
		const raw = rawById.get(laid.id);
		if (!raw) continue;
		const rawShape = raw.shape && raw.shape.length >= 3 ? raw.shape.map((p) => ({ ...p })) : null;
		const activeSeats = (raw.seats ?? []).filter((seat) => seat.is_active !== false);
		blocks.push({
			id: laid.id,
			name: laid.name,
			kind: laid.kind,
			seats: laid.seats.map((seat) => ({
				id: seat.seatId,
				label: seat.label,
				x: seat.x,
				y: seat.y
			})),
			shape: laid.shape ? laid.shape.map((p) => ({ ...p })) : null,
			width: laid.width,
			height: laid.height,
			transform: { ...laid.transform },
			shapeFrameOffset: computeShapeFrameOffset(raw, rawShape),
			metadata: asMetadata(raw.metadata),
			floorId: explicitFloorId(asMetadata(raw.metadata), floors),
			hasSeats: laid.seats.length > 0,
			hasCompletePositions:
				activeSeats.length > 0 && activeSeats.every((seat) => Boolean(seat.position))
		});
	}
	// Preserve the buyer's display order for a stable list/tab order.
	blocks.sort(
		(a, b) =>
			a.transform.y - b.transform.y || a.transform.x - b.transform.x || collate(a.name, b.name)
	);

	const stage = parseStage(venueMetadata) ?? defaultStage(blocks);
	return { blocks, stage, venueMetadata: asMetadata(venueMetadata), floors };
}

/** Local center of a block (the pivot for rotation). */
export function blockLocalCenter(block: Pick<DesignerBlock, 'width' | 'height'>): Coordinate2d {
	return { x: block.width / 2, y: block.height / 2 };
}
