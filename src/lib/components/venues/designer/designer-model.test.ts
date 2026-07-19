import { describe, it, expect } from 'vitest';
import type {
	Coordinate2d,
	VenueSeatSchema,
	VenueSectorWithSeatsSchema
} from '$lib/api/generated/types.gen';
import { SECTOR_GAP } from '$lib/components/tickets/seat-map-layout';
import {
	buildDesignerModel,
	toPersistFrame,
	EMPTY_SECTOR_WIDTH,
	type DesignerModel,
	type DesignerSeat
} from './designer-model';

function seat(id: string, label: string, extra: Partial<VenueSeatSchema> = {}): VenueSeatSchema {
	return { id, label, is_active: true, ...extra };
}

function mustSeat(model: DesignerModel, id: string): DesignerSeat {
	const found = model.seats.find((s) => s.id === id);
	if (!found) throw new Error(`seat ${id} missing from model`);
	return found;
}

function mustShape(model: DesignerModel, sectorIndex = 0): Coordinate2d[] {
	const shape = model.sectors[sectorIndex]?.shape;
	if (!shape) throw new Error('expected sector shape');
	return shape;
}

describe('buildDesignerModel', () => {
	it('keeps raw stored positions round-trippable (persist frame is exact)', () => {
		// Positions deliberately offset from (0,0): min is (5, 7).
		const sectors: VenueSectorWithSeatsSchema[] = [
			{
				id: 'sec-1',
				name: 'Floor',
				seats: [
					seat('s1', 'A1', { position: { x: 5, y: 7 } }),
					seat('s2', 'A2', { position: { x: 6.5, y: 7 } }),
					seat('s3', 'B1', { position: { x: 5, y: 8.5 } })
				]
			}
		];
		const model = buildDesignerModel(sectors);
		const sector = model.sectors[0];
		expect(sector.hasCompletePositions).toBe(true);

		// Global coordinates are normalized to the canvas, but mapping back
		// through the persist frame must return the exact stored values.
		expect(toPersistFrame(mustSeat(model, 's1'), sector)).toEqual({ x: 5, y: 7 });
		expect(toPersistFrame(mustSeat(model, 's2'), sector)).toEqual({ x: 6.5, y: 7 });
		expect(toPersistFrame(mustSeat(model, 's3'), sector)).toEqual({ x: 5, y: 8.5 });
	});

	it('preserves the RAW shape/seat relative offset (unlike the public map)', () => {
		const sectors: VenueSectorWithSeatsSchema[] = [
			{
				id: 'sec-1',
				name: 'Floor',
				shape: [
					{ x: 4, y: 6 },
					{ x: 10, y: 6 },
					{ x: 10, y: 10 },
					{ x: 4, y: 10 }
				],
				seats: [seat('s1', 'A1', { position: { x: 5, y: 7 } })]
			}
		];
		const model = buildDesignerModel(sectors);
		const sector = model.sectors[0];
		const s1 = model.seats[0];
		// Shape vertex (4,6) sits 1 unit left/up of the seat at (5,7) — the
		// designer keeps that relationship in the global frame.
		const shape = mustShape(model);
		expect(shape[0].x).toBeCloseTo(s1.x - 1);
		expect(shape[0].y).toBeCloseTo(s1.y - 1);
		// And the shape round-trips exactly through the persist frame.
		expect(toPersistFrame(shape[0], sector)).toEqual({ x: 4, y: 6 });
	});

	it('grid-derives unpositioned seats but preserves stored positions in a mixed sector', () => {
		const sectors: VenueSectorWithSeatsSchema[] = [
			{
				id: 'sec-1',
				name: 'Balcony',
				seats: [
					seat('s1', 'A1', { row_label: 'A', number: 1 }),
					seat('s2', 'A2', { row_label: 'A', number: 2 }),
					seat('s3', 'B1', { row_label: 'B', number: 1, position: { x: 9, y: 9 } })
				]
			}
		];
		const model = buildDesignerModel(sectors);
		const sector = model.sectors[0];
		// Sector is still incomplete (not every seat is positioned)...
		expect(sector.hasCompletePositions).toBe(false);
		// ...but the seat that DOES have a stored position keeps its real
		// coordinate; only the unpositioned seats are grid-derived. Grid-deriving
		// s3 to {0,1} here would silently destroy its curated position on save.
		expect(toPersistFrame(mustSeat(model, 's1'), sector)).toEqual({ x: 0, y: 0 });
		expect(toPersistFrame(mustSeat(model, 's2'), sector)).toEqual({ x: 1, y: 0 });
		expect(toPersistFrame(mustSeat(model, 's3'), sector)).toEqual({ x: 9, y: 9 });
	});

	it('round-trips a mixed sector through the persist frame without losing curated coords', () => {
		// A sector where a first save batch committed freeform positions for two
		// seats (offset from origin), while a later batch failed so the rest stay
		// null — the exact partial-write state that reaches the designer on reload.
		const positioned: Array<[string, Coordinate2d]> = [
			['p1', { x: 12, y: 5 }],
			['p2', { x: 13.5, y: 5 }],
			['p3', { x: 12, y: 6.5 }]
		];
		const sectors: VenueSectorWithSeatsSchema[] = [
			{
				id: 'sec-1',
				name: 'Floor',
				seats: [
					...positioned.map(([id, position], i) => seat(id, `P${i + 1}`, { position })),
					seat('u1', 'U1', { row_label: 'Z', number: 1 }),
					seat('u2', 'U2', { row_label: 'Z', number: 2 })
				]
			}
		];
		const model = buildDesignerModel(sectors);
		const sector = model.sectors[0];
		expect(sector.hasCompletePositions).toBe(false);

		// Every positioned seat maps back to its EXACT stored coordinate.
		for (const [id, position] of positioned) {
			expect(toPersistFrame(mustSeat(model, id), sector)).toEqual(position);
		}

		// The unpositioned seats are grid-derived (not null, not colliding with
		// the curated ones) so the sector can converge to complete on save.
		const u1 = toPersistFrame(mustSeat(model, 'u1'), sector);
		const u2 = toPersistFrame(mustSeat(model, 'u2'), sector);
		expect(u2.x).toBeCloseTo(u1.x + 1);
		expect(u1.y).toEqual(u2.y);
		const curated = new Set(positioned.map(([, p]) => `${p.x},${p.y}`));
		expect(curated.has(`${u1.x},${u1.y}`)).toBe(false);
		expect(curated.has(`${u2.x},${u2.y}`)).toBe(false);
	});

	it('stacks sectors vertically in display_order with a gap', () => {
		const sectors: VenueSectorWithSeatsSchema[] = [
			{
				id: 'sec-2',
				name: 'Balcony',
				display_order: 2,
				seats: [seat('s2', 'A1', { row_label: 'A', number: 1 })]
			},
			{
				id: 'sec-1',
				name: 'Floor',
				display_order: 1,
				seats: [
					seat('s1a', 'A1', { position: { x: 0, y: 0 } }),
					seat('s1b', 'A2', { position: { x: 1, y: 0 } })
				]
			}
		];
		const model = buildDesignerModel(sectors);
		expect(model.sectors.map((s) => s.id)).toEqual(['sec-1', 'sec-2']);
		// Floor bbox: x 0..2 (seat cell extends +1), y 0..1 → height 1.
		expect(model.sectors[0].origin).toEqual({ x: 0, y: 0 });
		expect(model.sectors[1].origin).toEqual({ x: 0, y: 1 + SECTOR_GAP });
	});

	it('skips inactive seats and seats without ids, keeps empty sectors selectable', () => {
		const sectors: VenueSectorWithSeatsSchema[] = [
			{
				id: 'sec-1',
				name: 'Standing pit',
				seats: [
					{ id: 's-inactive', label: 'X1', is_active: false },
					{ label: 'X2', is_active: true }
				]
			}
		];
		const model = buildDesignerModel(sectors);
		expect(model.seats).toEqual([]);
		expect(model.sectors).toHaveLength(1);
		expect(model.sectors[0].hasSeats).toBe(false);
		expect(model.sectors[0].width).toBe(EMPTY_SECTOR_WIDTH);
	});

	it('threads each seat painted price-category id (null when unpainted)', () => {
		const sectors: VenueSectorWithSeatsSchema[] = [
			{
				id: 'sec-1',
				name: 'Floor',
				seats: [
					seat('s1', 'A1', { position: { x: 0, y: 0 }, price_category_id: 'gold' }),
					seat('s2', 'A2', { position: { x: 1, y: 0 } })
				]
			}
		];
		const model = buildDesignerModel(sectors);
		expect(mustSeat(model, 's1').priceCategoryId).toBe('gold');
		expect(mustSeat(model, 's2').priceCategoryId).toBeNull();
	});

	it('ignores stored shapes with fewer than 3 vertices', () => {
		const sectors: VenueSectorWithSeatsSchema[] = [
			{
				id: 'sec-1',
				name: 'Floor',
				shape: [
					{ x: 0, y: 0 },
					{ x: 1, y: 1 }
				],
				seats: [seat('s1', 'A1', { position: { x: 0, y: 0 } })]
			}
		];
		expect(buildDesignerModel(sectors).sectors[0].shape).toBeNull();
	});
});
