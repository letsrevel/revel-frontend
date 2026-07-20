import { describe, it, expect } from 'vitest';
import type {
	ChartSeatSchema,
	ChartSectorSchema,
	VenueChartSchema
} from '$lib/api/generated/types.gen';
import { computeSeatMapLayout, parseAisleMetadata, SECTOR_GAP } from './seat-map-layout';

function seat(id: string, overrides: Partial<ChartSeatSchema> = {}): ChartSeatSchema {
	return {
		id,
		label: id.toUpperCase(),
		row_label: 'A',
		row_order: 0,
		number: 1,
		adjacency_index: 0,
		is_accessible: false,
		is_obstructed_view: false,
		is_active: true,
		price_category_id: null,
		...overrides
	};
}

function sector(
	id: string,
	seats: ChartSeatSchema[],
	overrides: Partial<ChartSectorSchema> = {}
): ChartSectorSchema {
	return { id, name: `Sector ${id}`, kind: 'seated', seats, ...overrides };
}

function chart(sectors: ChartSectorSchema[]): VenueChartSchema {
	return {
		venue_id: 'venue-1',
		venue_name: 'Test Hall',
		updated_at: '2026-07-18T00:00:00Z',
		price_categories: [],
		sectors
	};
}

function pointsOf(layoutChart: VenueChartSchema, sectorId: string) {
	const laid = computeSeatMapLayout(layoutChart).sectors.find((s) => s.id === sectorId);
	if (!laid) throw new Error(`sector ${sectorId} missing from layout`);
	return laid;
}

describe('parseAisleMetadata', () => {
	it('parses the grid-editor aisles contract', () => {
		expect(
			parseAisleMetadata({
				aisles: { verticalAisles: [1, 3], horizontalAisles: [0], invertRowOrder: true }
			})
		).toEqual({ verticalAisles: [1, 3], horizontalAisles: [0], invertRowOrder: true });
	});

	it('is defensive about malformed metadata', () => {
		const empty = { verticalAisles: [], horizontalAisles: [], invertRowOrder: false };
		expect(parseAisleMetadata(null)).toEqual(empty);
		expect(parseAisleMetadata(undefined)).toEqual(empty);
		expect(parseAisleMetadata({ aisles: 'nope' })).toEqual(empty);
		expect(
			parseAisleMetadata({
				aisles: { verticalAisles: [1, 'x', null], horizontalAisles: 3, invertRowOrder: 'yes' }
			})
		).toEqual({ verticalAisles: [1], horizontalAisles: [], invertRowOrder: false });
	});
});

describe('computeSeatMapLayout — position passthrough', () => {
	it('uses seat positions when every seat of the sector has one, normalized to the sector origin', () => {
		const laid = pointsOf(
			chart([
				sector('s1', [
					seat('a1', { position: { x: 2, y: 3 } }),
					seat('a2', { position: { x: 4, y: 5 }, adjacency_index: 1 })
				])
			]),
			's1'
		);
		expect(laid.seats).toEqual([
			{ seatId: 'a1', label: 'A1', x: 0, y: 0 },
			{ seatId: 'a2', label: 'A2', x: 2, y: 2 }
		]);
		expect(laid.width).toBe(3);
		expect(laid.height).toBe(3);
	});

	it('falls back to grid derivation when any seat lacks a position', () => {
		const laid = pointsOf(
			chart([
				sector('s1', [
					// Position far away — must be ignored because a2 has none.
					seat('a1', { position: { x: 40, y: 40 } }),
					seat('a2', { position: null, adjacency_index: 1, number: 2 })
				])
			]),
			's1'
		);
		expect(laid.seats).toEqual([
			{ seatId: 'a1', label: 'A1', x: 0, y: 0 },
			{ seatId: 'a2', label: 'A2', x: 1, y: 0 }
		]);
	});
});

describe('computeSeatMapLayout — grid derivation', () => {
	it('derives rows from row order/labels (front row at top) and columns from adjacency', () => {
		const laid = pointsOf(
			chart([
				sector('s1', [
					seat('b1', { row_label: 'B', row_order: 1 }),
					seat('a2', { adjacency_index: 1, number: 2 }),
					seat('a1')
				])
			]),
			's1'
		);
		expect(laid.seats).toEqual([
			{ seatId: 'a1', label: 'A1', x: 0, y: 0 },
			{ seatId: 'a2', label: 'A2', x: 1, y: 0 },
			{ seatId: 'b1', label: 'B1', x: 0, y: 1 }
		]);
		expect(laid.width).toBe(2);
		expect(laid.height).toBe(2);
	});

	it('falls back to ordinal columns when adjacency indices collide within a row', () => {
		const laid = pointsOf(
			chart([
				sector('s1', [
					seat('a1', { adjacency_index: 0, number: 1 }),
					seat('a2', { adjacency_index: 0, number: 2 }),
					seat('a3', { adjacency_index: 0, number: 3 })
				])
			]),
			's1'
		);
		expect(laid.seats.map((p) => [p.seatId, p.x])).toEqual([
			['a1', 0],
			['a2', 1],
			['a3', 2]
		]);
	});

	it('inserts a vertical gap after an aisle column', () => {
		const laid = pointsOf(
			chart([
				sector(
					's1',
					[
						seat('a1'),
						seat('a2', { adjacency_index: 1, number: 2 }),
						seat('a3', { adjacency_index: 2, number: 3 })
					],
					{
						metadata: {
							aisles: { verticalAisles: [1], horizontalAisles: [], invertRowOrder: false }
						}
					}
				)
			]),
			's1'
		);
		// Aisle after column 1: column 2 shifts to x 3.
		expect(laid.seats.map((p) => p.x)).toEqual([0, 1, 3]);
		expect(laid.width).toBe(4);
	});

	it('inserts a horizontal gap after an aisle row', () => {
		const laid = pointsOf(
			chart([
				sector(
					's1',
					[
						seat('a1'),
						seat('b1', { row_label: 'B', row_order: 1 }),
						seat('c1', { row_label: 'C', row_order: 2 })
					],
					{
						metadata: {
							aisles: { verticalAisles: [], horizontalAisles: [0], invertRowOrder: false }
						}
					}
				)
			]),
			's1'
		);
		// Aisle after row 0 (A): B and C shift down by one.
		expect(laid.seats.map((p) => [p.seatId, p.y])).toEqual([
			['a1', 0],
			['b1', 2],
			['c1', 3]
		]);
		expect(laid.height).toBe(4);
	});

	it('flips rows (and their aisle gaps) when invertRowOrder is set', () => {
		const laid = pointsOf(
			chart([
				sector(
					's1',
					[
						seat('a1'),
						seat('b1', { row_label: 'B', row_order: 1 }),
						seat('c1', { row_label: 'C', row_order: 2 })
					],
					{
						metadata: {
							aisles: { verticalAisles: [], horizontalAisles: [0], invertRowOrder: true }
						}
					}
				)
			]),
			's1'
		);
		// Row A at the bottom; the A|B aisle gap flips to sit between them there.
		expect(laid.seats.map((p) => [p.seatId, p.y])).toEqual([
			['a1', 3],
			['b1', 1],
			['c1', 0]
		]);
		expect(laid.height).toBe(4);
	});

	it('excludes inactive seats', () => {
		const laid = pointsOf(
			chart([sector('s1', [seat('a1'), seat('a2', { is_active: false, adjacency_index: 1 })])]),
			's1'
		);
		expect(laid.seats.map((p) => p.seatId)).toEqual(['a1']);
	});
});

describe('computeSeatMapLayout — standing zones and shapes', () => {
	it('sizes a standing zone relative to capacity, with no seats', () => {
		const laid = pointsOf(chart([sector('s1', [], { kind: 'standing', capacity: 40 })]), 's1');
		expect(laid.kind).toBe('standing');
		expect(laid.seats).toEqual([]);
		expect(laid.width).toBe(5);
		expect(laid.height).toBe(2);
	});

	it('uses a default zone size when capacity is missing', () => {
		const laid = pointsOf(chart([sector('s1', [], { kind: 'standing', capacity: null })]), 's1');
		expect(laid.width).toBe(6);
		expect(laid.height).toBe(2);
	});

	it('grows the zone with capacity', () => {
		const small = pointsOf(chart([sector('s1', [], { kind: 'standing', capacity: 20 })]), 's1');
		const large = pointsOf(chart([sector('s1', [], { kind: 'standing', capacity: 500 })]), 's1');
		expect(large.width * large.height).toBeGreaterThan(small.width * small.height);
	});

	it('preserves the shape/seat relative offset in one shared frame when all seats have positions', () => {
		// Mirrors the designer round-trip: shape saved AROUND the seats in the
		// same frame (shape min (1,1), seats inside at (3,4)/(5,6)). Independent
		// normalization would snap the shape onto the seats' origin.
		const laid = pointsOf(
			chart([
				sector(
					's1',
					[
						seat('a1', { position: { x: 3, y: 4 } }),
						seat('a2', { position: { x: 5, y: 6 }, adjacency_index: 1 })
					],
					{
						shape: [
							{ x: 1, y: 1 },
							{ x: 9, y: 1 },
							{ x: 9, y: 9 },
							{ x: 1, y: 9 }
						]
					}
				)
			]),
			's1'
		);
		// Shared minimum is the shape's (1,1) — seats keep their inset.
		expect(laid.seats).toEqual([
			{ seatId: 'a1', label: 'A1', x: 2, y: 3 },
			{ seatId: 'a2', label: 'A2', x: 4, y: 5 }
		]);
		expect(laid.shape).toEqual([
			{ x: 0, y: 0 },
			{ x: 8, y: 0 },
			{ x: 8, y: 8 },
			{ x: 0, y: 8 }
		]);
		expect(laid.width).toBe(8);
		expect(laid.height).toBe(8);
	});

	it('keeps a shape offset BESIDE positioned seats (seats define the shared minimum)', () => {
		const laid = pointsOf(
			chart([
				sector(
					's1',
					[seat('a1', { position: { x: 0, y: 0 } }), seat('a2', { position: { x: 1, y: 0 } })],
					{
						shape: [
							{ x: 3, y: 0 },
							{ x: 6, y: 0 },
							{ x: 6, y: 3 }
						]
					}
				)
			]),
			's1'
		);
		// Seats already sit at the shared minimum; the shape must NOT collapse
		// onto them.
		expect(laid.seats.map((p) => [p.x, p.y])).toEqual([
			[0, 0],
			[1, 0]
		]);
		expect(laid.shape).toEqual([
			{ x: 3, y: 0 },
			{ x: 6, y: 0 },
			{ x: 6, y: 3 }
		]);
		expect(laid.width).toBe(6);
		expect(laid.height).toBe(3);
	});

	it('normalizes shape polygons to the sector origin and extends the sector bounds', () => {
		const laid = pointsOf(
			chart([
				sector('s1', [seat('a1')], {
					shape: [
						{ x: 10, y: 10 },
						{ x: 14, y: 10 },
						{ x: 12, y: 13 }
					]
				})
			]),
			's1'
		);
		expect(laid.shape).toEqual([
			{ x: 0, y: 0 },
			{ x: 4, y: 0 },
			{ x: 2, y: 3 }
		]);
		expect(laid.width).toBe(4);
		expect(laid.height).toBe(3);
	});
});

describe('computeSeatMapLayout — sector stacking', () => {
	it('stacks sectors vertically in display_order with a gap and computes overall bounds', () => {
		const layout = computeSeatMapLayout(
			chart([
				// display_order deliberately reversed vs array order.
				sector('second', [seat('a1'), seat('a2', { adjacency_index: 1, number: 2 })], {
					display_order: 2
				}),
				sector(
					'first',
					[
						seat('b1', { row_label: 'A' }),
						seat('b2', { row_label: 'B', row_order: 1 }),
						seat('b3', { row_label: 'C', row_order: 2 })
					],
					{ display_order: 1 }
				)
			])
		);
		expect(layout.sectors.map((s) => s.id)).toEqual(['first', 'second']);
		// Un-arranged sectors get an implicit stacked transform (rotation 0).
		expect(layout.sectors[0].transform).toEqual({ x: 0, y: 0, rotation: 0 });
		expect(layout.sectors[1].transform).toEqual({ x: 0, y: 3 + SECTOR_GAP, rotation: 0 });
		// World bounds match the old stacked extents exactly (backward compatible).
		expect(layout.minX).toBe(0);
		expect(layout.minY).toBe(0);
		expect(layout.width).toBe(2);
		expect(layout.height).toBe(3 + SECTOR_GAP + 1);
		expect(layout.unit).toBe(1);
	});

	it('skips seated sectors with no active seats and no shape', () => {
		const layout = computeSeatMapLayout(
			chart([sector('empty', []), sector('inactive', [seat('a1', { is_active: false })])])
		);
		expect(layout.sectors).toEqual([]);
		expect(layout.width).toBe(0);
		expect(layout.height).toBe(0);
	});

	it('handles an empty chart', () => {
		expect(computeSeatMapLayout(chart([]))).toEqual({
			sectors: [],
			width: 0,
			height: 0,
			minX: 0,
			minY: 0,
			unit: 1
		});
	});
});

describe('computeSeatMapLayout — sector transforms', () => {
	it('honors a parsed metadata.transform instead of stacking', () => {
		const layout = computeSeatMapLayout(
			chart([
				sector('s1', [seat('a1'), seat('a2', { adjacency_index: 1, number: 2 })], {
					metadata: { transform: { x: 5, y: 8, rotation: 0 } }
				})
			])
		);
		expect(layout.sectors[0].transform).toEqual({ x: 5, y: 8, rotation: 0 });
		// A single un-rotated sector at (5,8): local 2x1 seats -> world bounds
		// [5..7] x [8..9]; minX/minY track the placement.
		expect(layout.minX).toBe(5);
		expect(layout.minY).toBe(8);
		expect(layout.width).toBe(2);
		expect(layout.height).toBe(1);
	});

	it('computes world bounds for a rotated sector (90° swaps extents)', () => {
		// A 2-wide, 1-tall sector rotated 90° clockwise about local origin, then
		// placed at (10, 20). Local corners (0,0),(2,0),(2,1),(0,1) ->
		// world (10,20),(10,22),(9,22),(9,21): bbox x[9..10] (w=1), y[20..22] (h=2).
		const layout = computeSeatMapLayout(
			chart([
				sector('s1', [seat('a1'), seat('a2', { adjacency_index: 1, number: 2 })], {
					metadata: { transform: { x: 10, y: 20, rotation: 90 } }
				})
			])
		);
		expect(layout.sectors[0].transform.rotation).toBe(90);
		expect(layout.minX).toBeCloseTo(9, 6);
		expect(layout.minY).toBeCloseTo(20, 6);
		expect(layout.width).toBeCloseTo(1, 6);
		expect(layout.height).toBeCloseTo(2, 6);
		// Seats themselves stay in sector-LOCAL coords (the transform is applied
		// by the renderer, not baked into the points).
		expect(layout.sectors[0].seats).toEqual([
			{ seatId: 'a1', label: 'A1', x: 0, y: 0 },
			{ seatId: 'a2', label: 'A2', x: 1, y: 0 }
		]);
	});

	it('unions transformed and default-stacked sectors into one world box', () => {
		const layout = computeSeatMapLayout(
			chart([
				// Explicitly placed far to the right; does not consume stacking space.
				sector('placed', [seat('a1')], {
					display_order: 1,
					metadata: { transform: { x: 20, y: 0, rotation: 0 } }
				}),
				// Un-arranged: stacks from the top-left as today.
				sector('stacked', [seat('b1')], { display_order: 2 })
			])
		);
		const placed = layout.sectors.find((s) => s.id === 'placed');
		const stacked = layout.sectors.find((s) => s.id === 'stacked');
		expect(placed?.transform).toEqual({ x: 20, y: 0, rotation: 0 });
		expect(stacked?.transform).toEqual({ x: 0, y: 0, rotation: 0 });
		expect(layout.minX).toBe(0);
		expect(layout.width).toBe(21);
	});
});
