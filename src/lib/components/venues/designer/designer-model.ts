/**
 * Designer scene model: turns the org-admin sector list into a single global
 * canvas (layout units) the designer can edit, while remembering how to map
 * every sector back into the coordinate frame the backend stores.
 *
 * Unlike the public map's computeSeatMapLayout — which normalizes seat
 * positions and sector shapes independently to their own minima (fine for
 * display, lossy for editing) — the designer keeps each sector's seats and
 * shape in ONE shared frame: the sector's raw stored coordinates when seat
 * positions exist, or the derived grid frame otherwise. Sectors are stacked
 * vertically like the public map; `frameOffset` records the translation from
 * the stacked global frame back to the persisted frame, so saving is exact
 * (`persisted = global - origin + frameOffset`) and containment checks are
 * WYSIWYG (translation-invariant).
 */
import type {
	ChartSectorSchema,
	Coordinate2d,
	VenueSeatSchema,
	VenueSectorWithSeatsSchema
} from '$lib/api/generated/types.gen';
import { computeSeatMapLayout, SECTOR_GAP } from '$lib/components/tickets/seat-map-layout';
import { roundCoord } from './designer-geometry';

/** A seat placed on the designer's global canvas (layout units). */
export interface DesignerSeat {
	id: string;
	label: string;
	sectorId: string;
	x: number;
	y: number;
	isAccessible: boolean;
	isObstructedView: boolean;
	/** Painted price-category id (from the grid editor); null when unpainted. */
	priceCategoryId: string | null;
}

export interface DesignerSector {
	id: string;
	name: string;
	/** Top-left corner of the sector's bounding box on the global canvas. */
	origin: Coordinate2d;
	/** Translation from global back to the persisted frame (the bbox minimum). */
	frameOffset: Coordinate2d;
	/** True when every active seat already has a stored position (raw frame). */
	hasCompletePositions: boolean;
	/** Stored shape mapped onto the global canvas; null when absent. */
	shape: Coordinate2d[] | null;
	width: number;
	height: number;
	hasSeats: boolean;
}

export interface DesignerModel {
	sectors: DesignerSector[];
	seats: DesignerSeat[];
	width: number;
	height: number;
}

/** Canvas footprint for sectors with no seats and no shape (still selectable). */
export const EMPTY_SECTOR_WIDTH = 6;
export const EMPTY_SECTOR_HEIGHT = 3;

/** Map a designer-global point back into the sector's persisted frame. */
export function toPersistFrame(
	global: Coordinate2d,
	sector: Pick<DesignerSector, 'origin' | 'frameOffset'>
): Coordinate2d {
	return {
		x: roundCoord(global.x - sector.origin.x + sector.frameOffset.x),
		y: roundCoord(global.y - sector.origin.y + sector.frameOffset.y)
	};
}

function collate(a: string, b: string): number {
	return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

type ActiveSeat = VenueSeatSchema & { id: string };

function activeSeats(sector: VenueSectorWithSeatsSchema): ActiveSeat[] {
	return (sector.seats ?? []).filter(
		(seat): seat is ActiveSeat => seat.is_active !== false && typeof seat.id === 'string'
	);
}

/**
 * Adapter for the grid-derivation path: a single-sector chart with positions
 * stripped, so computeSeatMapLayout applies its row_label/number grid rules
 * (the same ones the public map uses for grid-editor sectors).
 */
function gridChartSector(
	sector: VenueSectorWithSeatsSchema,
	seats: ActiveSeat[]
): ChartSectorSchema {
	return {
		id: sector.id ?? '',
		name: sector.name,
		kind: 'seated',
		shape: null,
		display_order: 0,
		seats: seats.map((seat) => ({
			id: seat.id,
			label: seat.label,
			row_label: seat.row_label ?? seat.row ?? null,
			number: seat.number ?? null,
			position: null,
			is_active: true
		}))
	};
}

/** Sector-local seat coordinates in the frame we will persist back into. */
function localSeatPoints(
	sector: VenueSectorWithSeatsSchema,
	seats: ActiveSeat[],
	complete: boolean
): Map<string, Coordinate2d> {
	const local = new Map<string, Coordinate2d>();
	if (complete) {
		for (const seat of seats) {
			const position = seat.position as Coordinate2d;
			local.set(seat.id, { x: position.x, y: position.y });
		}
		return local;
	}
	if (seats.length === 0) return local;
	// Partially-positioned sector: grid-derive a layout for the seats that lack a
	// stored position, but keep the REAL stored coordinate for any seat that
	// already has one. Grid-deriving all seats here would discard the curated
	// positions of the placed seats and, since the materialize-all save writes
	// every seat once the sector is incomplete, permanently overwrite them with
	// grid coordinates on the next edit (silent data loss).
	const layout = computeSeatMapLayout({
		venue_id: '',
		venue_name: '',
		updated_at: '',
		sectors: [gridChartSector(sector, seats)]
	});
	for (const point of layout.sectors[0]?.seats ?? []) {
		local.set(point.seatId, { x: point.x, y: point.y });
	}
	for (const seat of seats) {
		if (seat.position) {
			const position = seat.position as Coordinate2d;
			local.set(seat.id, { x: position.x, y: position.y });
		}
	}
	return local;
}

/**
 * Build the designer model. Sectors stack vertically in display_order (name as
 * a numeric-aware tiebreak) with SECTOR_GAP units between bounding boxes.
 */
export function buildDesignerModel(rawSectors: VenueSectorWithSeatsSchema[]): DesignerModel {
	const ordered = rawSectors
		.filter(
			(sector): sector is VenueSectorWithSeatsSchema & { id: string } =>
				typeof sector.id === 'string'
		)
		.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0) || collate(a.name, b.name));

	const sectors: DesignerSector[] = [];
	const seats: DesignerSeat[] = [];
	let cursorY = 0;
	let width = 0;

	for (const sector of ordered) {
		const active = activeSeats(sector);
		const complete = active.length > 0 && active.every((seat) => Boolean(seat.position));
		const local = localSeatPoints(sector, active, complete);
		const shapeLocal =
			sector.shape && sector.shape.length >= 3
				? sector.shape.map((p) => ({ x: p.x, y: p.y }))
				: null;

		// Bounding box over seat cells ([x, x+1] × [y, y+1]) and shape vertices.
		const xs: number[] = [];
		const ys: number[] = [];
		for (const point of local.values()) {
			xs.push(point.x, point.x + 1);
			ys.push(point.y, point.y + 1);
		}
		for (const vertex of shapeLocal ?? []) {
			xs.push(vertex.x);
			ys.push(vertex.y);
		}
		if (xs.length === 0) {
			xs.push(0, EMPTY_SECTOR_WIDTH);
			ys.push(0, EMPTY_SECTOR_HEIGHT);
		}
		const minX = Math.min(...xs);
		const minY = Math.min(...ys);
		const sectorWidth = Math.max(...xs) - minX;
		const sectorHeight = Math.max(...ys) - minY;

		const origin = { x: 0, y: cursorY };
		const frameOffset = { x: minX, y: minY };
		const toGlobal = (p: Coordinate2d): Coordinate2d => ({
			x: p.x - minX + origin.x,
			y: p.y - minY + origin.y
		});

		for (const seat of active) {
			const point = local.get(seat.id);
			if (!point) continue;
			const global = toGlobal(point);
			seats.push({
				id: seat.id,
				label: seat.label,
				sectorId: sector.id,
				x: global.x,
				y: global.y,
				isAccessible: seat.is_accessible ?? false,
				isObstructedView: seat.is_obstructed_view ?? false,
				priceCategoryId: seat.price_category_id ?? null
			});
		}

		sectors.push({
			id: sector.id,
			name: sector.name,
			origin,
			frameOffset,
			hasCompletePositions: complete,
			shape: shapeLocal ? shapeLocal.map(toGlobal) : null,
			width: sectorWidth,
			height: sectorHeight,
			hasSeats: active.length > 0
		});

		cursorY += sectorHeight + SECTOR_GAP;
		width = Math.max(width, sectorWidth);
	}

	return {
		sectors,
		seats,
		width,
		height: sectors.length > 0 ? cursorY - SECTOR_GAP : 0
	};
}
