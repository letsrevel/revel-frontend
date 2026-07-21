import { describe, it, expect } from 'vitest';
import type {
	AffectedTierSchema,
	UnsellableZoneTierSchema,
	VenueSeatSchema
} from '$lib/api/generated/types.gen';
import type { SeatData } from './seat-grid-types';
import {
	buildSeatSavePlan,
	buildRowOrderLookup,
	deriveAdjacencyIndex,
	liveRepricedTiers,
	mergeAffectedTiers,
	mergeUnsellableZoneTiers,
	paintTextColor,
	readExistingPaint,
	type SeatSavePlanInput
} from './seat-grid-save';

// Letter rows, no aisles: label "A1" style, positions = raw indices
const getRowLabel = (i: number) => String.fromCharCode(65 + i);
const getSeatLabel = (r: number, c: number) => `${getRowLabel(r)}${c + 1}`;

function makeInput(
	cells: ReadonlyMap<string, SeatData>,
	existingSeats: VenueSeatSchema[] = [],
	options: { rows?: number; invertRowOrder?: boolean } = {}
): SeatSavePlanInput {
	return {
		cells,
		existingSeats,
		rows: options.rows ?? 5,
		invertRowOrder: options.invertRowOrder ?? false,
		getRowLabel,
		getSeatLabel,
		getXPosition: (c) => c,
		getYPosition: (r) => r
	};
}

function seat(overrides: Partial<SeatData> = {}): SeatData {
	return { exists: true, is_accessible: false, is_obstructed_view: false, ...overrides };
}

function existing(label: string, id: string): VenueSeatSchema {
	return { label, id };
}

describe('buildRowOrderLookup', () => {
	it('dense-ranks populated rows front-to-back top-down by default (stage on top)', () => {
		const lookup = buildRowOrderLookup([0, 1, 2, 3, 4], false);
		expect(lookup(0)).toBe(0);
		expect(lookup(4)).toBe(4);
	});

	it('flips the rank when row A sits at the bottom (invertRowOrder)', () => {
		const lookup = buildRowOrderLookup([0, 1, 2, 3, 4], true);
		expect(lookup(0)).toBe(4);
		expect(lookup(4)).toBe(0);
		expect(lookup(2)).toBe(2);
	});

	it('normalizes the front row to 0 even when the populated rows do not reach the grid top', () => {
		// Only rows 0..2 populated (e.g. a 3-row sector inside a rows=10 grid).
		// Inverted, the front row (logical 2, rendered nearest the stage) must be
		// row_order 0 — a DENSE rank over the 3 populated rows, not 9,8,7.
		const inverted = buildRowOrderLookup([0, 1, 2], true);
		expect(inverted(2)).toBe(0);
		expect(inverted(1)).toBe(1);
		expect(inverted(0)).toBe(2);

		// Non-inverted small sector still gets 0,1,2 front-to-back.
		const upright = buildRowOrderLookup([0, 1, 2], false);
		expect(upright(0)).toBe(0);
		expect(upright(1)).toBe(1);
		expect(upright(2)).toBe(2);
	});

	it('collapses gaps between populated rows (dense, not grid-index)', () => {
		const lookup = buildRowOrderLookup([0, 4, 7], false);
		expect(lookup(0)).toBe(0);
		expect(lookup(4)).toBe(1);
		expect(lookup(7)).toBe(2);
	});

	it('dedupes repeated row indices (one entry per populated row)', () => {
		// Every column of a row reports the same row index.
		const lookup = buildRowOrderLookup([2, 2, 2, 0, 0], true);
		expect(lookup(0)).toBe(1);
		expect(lookup(2)).toBe(0);
	});
});

describe('deriveAdjacencyIndex', () => {
	it('is the raw column index — aisles never shift adjacency', () => {
		expect(deriveAdjacencyIndex(0)).toBe(0);
		expect(deriveAdjacencyIndex(7)).toBe(7);
	});
});

describe('buildSeatSavePlan — creates', () => {
	it('includes explicit ranks and paint on new seats', () => {
		const cells = new Map<string, SeatData>([
			['1-2', seat({ priceCategoryId: 'pc-1' })] // row B, col 3
		]);

		const plan = buildSeatSavePlan(makeInput(cells));

		expect(plan.creates).toEqual([
			{
				label: 'B3',
				row: 'B',
				number: 3,
				position: { x: 2, y: 1 },
				is_accessible: false,
				is_obstructed_view: false,
				is_active: true,
				// The only populated row is this sector's front row — dense rank 0,
				// not the raw grid index (1).
				row_order: 0,
				adjacency_index: 2,
				price_category_id: 'pc-1'
			}
		]);
		expect(plan.updates).toEqual([]);
		expect(plan.deleteLabels).toEqual([]);
		expect(plan.paintBatches).toEqual([]);
	});

	it('omits price_category_id entirely for untouched new seats', () => {
		const plan = buildSeatSavePlan(makeInput(new Map([['0-0', seat()]])));

		expect(plan.creates).toHaveLength(1);
		expect(plan.creates[0]).not.toHaveProperty('price_category_id');
	});

	it('sends an explicit null for new seats painted with the eraser', () => {
		const plan = buildSeatSavePlan(makeInput(new Map([['0-0', seat({ priceCategoryId: null })]])));

		expect(plan.creates[0].price_category_id).toBeNull();
	});

	it('flips row_order on creates when invertRowOrder is set', () => {
		const cells = new Map<string, SeatData>([
			['0-0', seat()],
			['1-0', seat()],
			['2-0', seat()],
			['3-0', seat()],
			['4-0', seat()]
		]);

		const plan = buildSeatSavePlan(makeInput(cells, [], { rows: 5, invertRowOrder: true }));

		const byLabel = new Map(plan.creates.map((s) => [s.label, s]));
		expect(byLabel.get('A1')?.row_order).toBe(4);
		expect(byLabel.get('E1')?.row_order).toBe(0);
	});

	it('normalizes an inverted sector that does not fill the grid: front row = 0, not gridSize-offset', () => {
		// 3 populated rows (A,B,C) inside a 10-row grid, inverted so row A sits at
		// the bottom and row C is nearest the stage. The front row (C) must be
		// row_order 0 and the ranks must be 2,1,0 front-to-back — NOT 9,8,7, which
		// the old grid-index derivation produced and which distorted cross-sector
		// best-available scoring.
		const cells = new Map<string, SeatData>([
			['0-0', seat()], // A
			['1-0', seat()], // B
			['2-0', seat()] // C
		]);

		const plan = buildSeatSavePlan(makeInput(cells, [], { rows: 10, invertRowOrder: true }));

		const byLabel = new Map(plan.creates.map((s) => [s.label, s.row_order]));
		expect(byLabel.get('A1')).toBe(2);
		expect(byLabel.get('B1')).toBe(1);
		expect(byLabel.get('C1')).toBe(0);
	});

	it('keeps a non-inverted small sector at 0,1,2 regardless of grid size', () => {
		const cells = new Map<string, SeatData>([
			['0-0', seat()], // A
			['1-0', seat()], // B
			['2-0', seat()] // C
		]);

		const plan = buildSeatSavePlan(makeInput(cells, [], { rows: 10, invertRowOrder: false }));

		const byLabel = new Map(plan.creates.map((s) => [s.label, s.row_order]));
		expect(byLabel.get('A1')).toBe(0);
		expect(byLabel.get('B1')).toBe(1);
		expect(byLabel.get('C1')).toBe(2);
	});

	it('skips non-existing cells and malformed keys', () => {
		const cells = new Map<string, SeatData>([
			['0-0', { ...seat(), exists: false }],
			['bogus', seat()]
		]);

		const plan = buildSeatSavePlan(makeInput(cells));

		expect(plan.creates).toEqual([]);
	});
});

describe('buildSeatSavePlan — updates and deletes', () => {
	it('routes existing labels to updates with explicit ranks and never with paint', () => {
		const cells = new Map<string, SeatData>([['0-1', seat({ priceCategoryId: 'pc-1' })]]);

		const plan = buildSeatSavePlan(makeInput(cells, [existing('A2', 'id-a2')]));

		expect(plan.creates).toEqual([]);
		expect(plan.updates).toEqual([
			{
				label: 'A2',
				row: 'A',
				number: 2,
				position: { x: 1, y: 0 },
				is_accessible: false,
				is_obstructed_view: false,
				is_active: true,
				row_order: 0,
				adjacency_index: 1
			}
		]);
		expect(plan.updates[0]).not.toHaveProperty('price_category_id');
	});

	it('flips row_order on updates when invertRowOrder is set (dense front row = 0)', () => {
		const cells = new Map<string, SeatData>([
			['0-0', seat()],
			['1-0', seat()],
			['2-0', seat()]
		]);

		const plan = buildSeatSavePlan(
			makeInput(
				cells,
				[existing('A1', 'id-a1'), existing('B1', 'id-b1'), existing('C1', 'id-c1')],
				{
					rows: 10,
					invertRowOrder: true
				}
			)
		);

		const byLabel = new Map(plan.updates.map((s) => [s.label, s.row_order]));
		expect(byLabel.get('A1')).toBe(2);
		expect(byLabel.get('C1')).toBe(0);
	});

	it('lists existing labels missing from the grid as deletions', () => {
		const cells = new Map<string, SeatData>([['0-0', seat()]]);

		const plan = buildSeatSavePlan(
			makeInput(cells, [existing('A1', 'id-a1'), existing('Z9', 'id-z9')])
		);

		expect(plan.deleteLabels).toEqual(['Z9']);
	});
});

describe('buildSeatSavePlan — paint batches', () => {
	it('batches touched existing seats by category with the unpaint batch last and sorted ids', () => {
		const cells = new Map<string, SeatData>([
			['0-0', seat({ priceCategoryId: 'pc-b' })], // A1
			['0-1', seat({ priceCategoryId: 'pc-a' })], // A2
			['0-2', seat({ priceCategoryId: null })], // A3 — eraser
			['0-3', seat({ priceCategoryId: 'pc-a' })], // A4
			['0-4', seat()] // A5 — untouched
		]);
		const existingSeats = [
			existing('A1', 'id-1'),
			existing('A2', 'id-4'),
			existing('A3', 'id-3'),
			existing('A4', 'id-2'),
			existing('A5', 'id-5')
		];

		const plan = buildSeatSavePlan(makeInput(cells, existingSeats));

		expect(plan.paintBatches).toEqual([
			{ price_category_id: 'pc-a', seat_ids: ['id-2', 'id-4'] },
			{ price_category_id: 'pc-b', seat_ids: ['id-1'] },
			{ price_category_id: null, seat_ids: ['id-3'] }
		]);
	});

	it('never batches new seats — their paint rides on the create payload', () => {
		const cells = new Map<string, SeatData>([['0-0', seat({ priceCategoryId: 'pc-1' })]]);

		const plan = buildSeatSavePlan(makeInput(cells, []));

		expect(plan.paintBatches).toEqual([]);
		expect(plan.creates[0].price_category_id).toBe('pc-1');
	});

	it('skips seats whose touched paint matches a known persisted baseline', () => {
		const painted = {
			...existing('A1', 'id-1'),
			price_category_id: 'pc-1'
		} as VenueSeatSchema;
		const cells = new Map<string, SeatData>([['0-0', seat({ priceCategoryId: 'pc-1' })]]);

		const plan = buildSeatSavePlan(makeInput(cells, [painted]));

		expect(plan.paintBatches).toEqual([]);
	});

	it('still batches when the touched paint differs from a known baseline', () => {
		const painted = {
			...existing('A1', 'id-1'),
			price_category_id: 'pc-1'
		} as VenueSeatSchema;
		const cells = new Map<string, SeatData>([['0-0', seat({ priceCategoryId: null })]]);

		const plan = buildSeatSavePlan(makeInput(cells, [painted]));

		expect(plan.paintBatches).toEqual([{ price_category_id: null, seat_ids: ['id-1'] }]);
	});

	it('always batches touched seats when the baseline is unknown (admin response lacks paint)', () => {
		const cells = new Map<string, SeatData>([['0-0', seat({ priceCategoryId: 'pc-1' })]]);

		const plan = buildSeatSavePlan(makeInput(cells, [existing('A1', 'id-1')]));

		expect(plan.paintBatches).toEqual([{ price_category_id: 'pc-1', seat_ids: ['id-1'] }]);
	});

	it('never unpaints on a reload-and-save round trip: untouched seats are absent from paintBatches', () => {
		// Admin read lacks price_category_id, so a previously painted venue
		// hydrates every cell with priceCategoryId undefined (= untouched).
		// Saving without touching paint must send NO paint batches at all —
		// especially not an unpaint (null) batch that would wipe existing paint.
		const cells = new Map<string, SeatData>([
			['0-0', seat()],
			['0-1', seat()],
			['1-0', seat({ is_accessible: true })]
		]);
		const existingSeats = [existing('A1', 'id-1'), existing('A2', 'id-2'), existing('B1', 'id-3')];

		const plan = buildSeatSavePlan(makeInput(cells, existingSeats));

		expect(plan.paintBatches).toEqual([]);
		expect(plan.updates).toHaveLength(3);
	});

	it('sends explicit eraser use on existing seats as an unpaint (null) batch', () => {
		const cells = new Map<string, SeatData>([
			['0-0', seat({ priceCategoryId: null })], // eraser
			['0-1', seat()] // untouched
		]);

		const plan = buildSeatSavePlan(
			makeInput(cells, [existing('A1', 'id-1'), existing('A2', 'id-2')])
		);

		expect(plan.paintBatches).toEqual([{ price_category_id: null, seat_ids: ['id-1'] }]);
	});

	it('skips existing seats without an id', () => {
		const cells = new Map<string, SeatData>([['0-0', seat({ priceCategoryId: 'pc-1' })]]);

		const plan = buildSeatSavePlan(makeInput(cells, [{ label: 'A1' }]));

		expect(plan.paintBatches).toEqual([]);
	});
});

describe('readExistingPaint', () => {
	it('returns undefined when the response has no price_category_id (current admin schema)', () => {
		expect(readExistingPaint(existing('A1', 'id-1'))).toBeUndefined();
	});

	it('passes through null and string values once the backend exposes them', () => {
		expect(
			readExistingPaint({ label: 'A1', price_category_id: null } as VenueSeatSchema)
		).toBeNull();
		expect(readExistingPaint({ label: 'A1', price_category_id: 'pc-1' } as VenueSeatSchema)).toBe(
			'pc-1'
		);
	});
});

describe('paintTextColor', () => {
	it('uses white text on dark swatches', () => {
		expect(paintTextColor('#000000')).toBe('#ffffff');
		expect(paintTextColor('#8C3CDD')).toBe('#ffffff');
	});

	it('uses black text on light swatches', () => {
		expect(paintTextColor('#ffffff')).toBe('#000000');
		expect(paintTextColor('#F9B233')).toBe('#000000');
	});

	it('expands 3-digit hex shorthand', () => {
		expect(paintTextColor('#fff')).toBe('#000000');
		expect(paintTextColor('#000')).toBe('#ffffff');
	});

	it('falls back to black for malformed colors', () => {
		expect(paintTextColor('not-a-color')).toBe('#000000');
		expect(paintTextColor('#12')).toBe('#000000');
	});
});

describe('mergeAffectedTiers', () => {
	const gap = (id: string, name: string) => ({ id, name, color: '#f00' });
	const move = (count: number, from: string | null, to: string | null) => ({
		seat_count: count,
		from_price: from,
		to_price: to
	});
	const tier = (
		tierId: string,
		overrides: Partial<AffectedTierSchema> = {}
	): AffectedTierSchema => ({
		tier_id: tierId,
		tier_name: `Tier ${tierId}`,
		event_id: `event-${tierId}`,
		event_name: `Event ${tierId}`,
		event_status: 'open',
		price_changes: [],
		missing_categories: [],
		...overrides
	});

	it('returns empty for no results or clean paints', () => {
		expect(mergeAffectedTiers([])).toEqual([]);
		expect(mergeAffectedTiers([{ painted: 3 }, { painted: 1, affected_tiers: [] }])).toEqual([]);
	});

	it('dedupes a tier across batches: price changes concatenated, gaps unioned', () => {
		const merged = mergeAffectedTiers([
			{
				painted: 1,
				affected_tiers: [
					tier('t1', {
						price_changes: [move(2, '80.00', '30.00')],
						missing_categories: [gap('a', 'A')]
					})
				]
			},
			{
				painted: 1,
				affected_tiers: [
					tier('t1', {
						price_changes: [move(1, null, '30.00')],
						missing_categories: [gap('a', 'A'), gap('b', 'B')]
					}),
					tier('t2', { missing_categories: [gap('b', 'B')] })
				]
			}
		]);
		expect(merged.map((t) => t.tier_id)).toEqual(['t1', 't2']);
		expect(merged[0].price_changes).toEqual([move(2, '80.00', '30.00'), move(1, null, '30.00')]);
		expect(merged[0].missing_categories?.map((c) => c.id)).toEqual(['a', 'b']);
	});

	describe('mergeUnsellableZoneTiers', () => {
		const zone = (id: string, name: string) => ({ id, name, color: '#00f' });
		const uTier = (
			tierId: string,
			zones: Array<{ id: string; name: string; color: string }>
		): UnsellableZoneTierSchema => ({
			tier_id: tierId,
			tier_name: `Tier ${tierId}`,
			event_id: `event-${tierId}`,
			event_name: `Event ${tierId}`,
			event_status: 'open',
			zones
		});

		it('returns empty for no results or clean paints', () => {
			expect(mergeUnsellableZoneTiers([])).toEqual([]);
			expect(
				mergeUnsellableZoneTiers([{ painted: 3 }, { painted: 1, unsellable_zone_tiers: [] }])
			).toEqual([]);
		});

		it('dedupes tiers across batches with zones unioned by id (current-state reports repeat)', () => {
			const merged = mergeUnsellableZoneTiers([
				{ painted: 1, unsellable_zone_tiers: [uTier('t1', [zone('a', 'A')])] },
				{
					painted: 1,
					unsellable_zone_tiers: [
						uTier('t1', [zone('a', 'A'), zone('b', 'B')]),
						uTier('t2', [zone('b', 'B')])
					]
				}
			]);
			expect(merged.map((t) => t.tier_id)).toEqual(['t1', 't2']);
			expect(merged[0].zones.map((z) => z.id)).toEqual(['a', 'b']);
			expect(merged[1].zones.map((z) => z.id)).toEqual(['b']);
		});

		it('does not mutate the input results', () => {
			const first = uTier('t1', [zone('a', 'A')]);
			mergeUnsellableZoneTiers([
				{ painted: 1, unsellable_zone_tiers: [first] },
				{ painted: 1, unsellable_zone_tiers: [uTier('t1', [zone('b', 'B')])] }
			]);
			expect(first.zones.map((z) => z.id)).toEqual(['a']);
		});
	});

	it('does not mutate the input results', () => {
		const first = tier('t1', { price_changes: [move(1, '80.00', '30.00')] });
		mergeAffectedTiers([
			{ painted: 1, affected_tiers: [first] },
			{ painted: 1, affected_tiers: [tier('t1', { price_changes: [move(1, '30.00', '80.00')] })] }
		]);
		expect(first.price_changes).toEqual([move(1, '80.00', '30.00')]);
	});

	describe('liveRepricedTiers', () => {
		it('keeps only price changes on OPEN events (live money)', () => {
			const tiers = [
				tier('live', { price_changes: [move(1, '80.00', '30.00')] }),
				tier('draft', { event_status: 'draft', price_changes: [move(1, '80.00', '30.00')] }),
				tier('gap-only', { missing_categories: [gap('a', 'A')] })
			];
			expect(liveRepricedTiers(tiers).map((t) => t.tier_id)).toEqual(['live']);
		});
	});
});
