import { describe, it, expect } from 'vitest';
import type {
	ChartSeatSchema,
	ChartSectorSchema,
	SeatingAvailabilitySchema,
	VenueChartSchema
} from '$lib/api/generated/types.gen';
import { buildSeatViews, rowsFromSeatViews, type SeatView } from './seating-view';

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

function sector(id: string, seats: ChartSeatSchema[], kind = 'seated'): ChartSectorSchema {
	return { id, name: `Sector ${id}`, kind, seats };
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

function availability(
	overrides: Partial<SeatingAvailabilitySchema> = {}
): SeatingAvailabilitySchema {
	return { seats: {}, standing: {}, my_holds: [], my_holds_expire_at: null, ...overrides };
}

const noSelection = { myHolds: [], pending: [] };

describe('buildSeatViews', () => {
	it('treats seats absent from the sparse map as available', () => {
		const views = buildSeatViews(
			chart([sector('s1', [seat('a1'), seat('a2', { number: 2, adjacency_index: 1 })])]),
			availability({ seats: { a2: 'sold' } }),
			noSelection
		);
		expect(views.map((v) => [v.id, v.status])).toEqual([
			['a1', 'available'],
			['a2', 'sold']
		]);
	});

	it('maps sold/held/blocked from the availability map and defaults unknown values to blocked', () => {
		const views = buildSeatViews(
			chart([
				sector('s1', [
					seat('a1'),
					seat('a2'),
					seat('a3'),
					seat('a4') // unknown status value
				])
			]),
			availability({ seats: { a1: 'sold', a2: 'held', a3: 'blocked', a4: 'weird-future-value' } }),
			noSelection
		);
		expect(views.map((v) => v.status)).toEqual(['sold', 'held', 'blocked', 'blocked']);
	});

	it('applies precedence pending > mine > availability map', () => {
		const views = buildSeatViews(
			chart([sector('s1', [seat('a1'), seat('a2'), seat('a3')])]),
			// The map marks all three as held (my own holds appear as held too).
			availability({ seats: { a1: 'held', a2: 'held', a3: 'held' } }),
			{ myHolds: ['a1', 'a2'], pending: ['a1'] }
		);
		expect(views.map((v) => [v.id, v.status])).toEqual([
			['a1', 'pending'],
			['a2', 'mine'],
			['a3', 'held']
		]);
	});

	it('filters to the given sector when sectorId is provided', () => {
		const views = buildSeatViews(
			chart([sector('s1', [seat('a1')]), sector('s2', [seat('b1')])]),
			availability(),
			{ ...noSelection, sectorId: 's2' }
		);
		expect(views.map((v) => v.id)).toEqual(['b1']);
	});

	it('excludes a standing sector even when it is the explicit sectorId (misconfigured tier)', () => {
		// A standing sector's spots can never be held (backend 409s every tap),
		// so a tier pointing at one must degrade to the empty state.
		const views = buildSeatViews(
			chart([sector('s1', [seat('a1')], 'standing'), sector('s2', [seat('b1')])]),
			availability(),
			{ ...noSelection, sectorId: 's1' }
		);
		expect(views).toEqual([]);
	});

	it('includes all seated sectors and excludes standing sectors when sectorId is absent', () => {
		const views = buildSeatViews(
			chart([
				sector('s1', [seat('a1')]),
				sector('s2', [seat('b1')], 'standing'),
				sector('s3', [seat('c1')])
			]),
			availability(),
			noSelection
		);
		expect(views.map((v) => v.id)).toEqual(['a1', 'c1']);
	});

	it('excludes inactive seats', () => {
		const views = buildSeatViews(
			chart([sector('s1', [seat('a1'), seat('a2', { is_active: false })])]),
			availability(),
			noSelection
		);
		expect(views.map((v) => v.id)).toEqual(['a1']);
	});

	it('maps chart fields onto the view (with fallbacks)', () => {
		const [view] = buildSeatViews(
			chart([
				sector('s1', [
					seat('a1', {
						label: 'A1',
						row_label: null,
						row_order: undefined,
						number: null,
						adjacency_index: undefined,
						is_accessible: true,
						is_obstructed_view: true
					})
				])
			]),
			availability(),
			noSelection
		);
		expect(view).toEqual({
			id: 'a1',
			label: 'A1',
			rowLabel: '?',
			rowOrder: 0,
			number: null,
			adjacencyIndex: 0,
			isAccessible: true,
			isObstructedView: true,
			status: 'available',
			priceCategoryId: null
		});
	});

	it('blocks seats painted with a category outside the sellable allow-list (#668)', () => {
		const views = buildSeatViews(
			chart([
				sector('s1', [
					seat('a1', { price_category_id: 'gold' }),
					seat('a2', { price_category_id: 'late', number: 2, adjacency_index: 1 }),
					seat('a3', { number: 3, adjacency_index: 2 })
				])
			]),
			availability(),
			{ ...noSelection, sellableCategoryIds: new Set(['gold']) }
		);
		expect(views.map((v) => [v.id, v.status, v.priceCategoryId])).toEqual([
			['a1', 'available', 'gold'],
			['a2', 'blocked', 'late'],
			['a3', 'available', null]
		]);
	});

	it('blocks a painted category the (stale) tier payload never listed — checkout would 400', () => {
		// The chart refetches mid-dialog (staleness echo) while the tier prop
		// does not: a freshly painted category id is absent from the allow-list
		// entirely and must grey out exactly like a listed-but-unpriced one.
		const views = buildSeatViews(
			chart([
				sector('s1', [
					seat('a1', { price_category_id: 'brand-new' }),
					seat('a2', { number: 2, adjacency_index: 1 })
				])
			]),
			availability(),
			{ ...noSelection, sellableCategoryIds: new Set(['gold']) }
		);
		expect(views.map((v) => [v.id, v.status])).toEqual([
			['a1', 'blocked'],
			['a2', 'available'] // unpainted seats are never category-filtered
		]);
	});

	it('blocks nothing by category on a flat tier (allow-list null)', () => {
		const views = buildSeatViews(
			chart([sector('s1', [seat('a1', { price_category_id: 'anything' })])]),
			availability(),
			{ ...noSelection, sellableCategoryIds: null }
		);
		expect(views[0].status).toBe('available');
	});

	it("never blocks the caller's own holds or pending seats by category", () => {
		const views = buildSeatViews(
			chart([
				sector('s1', [
					seat('a1', { price_category_id: 'late' }),
					seat('a2', { price_category_id: 'late', number: 2, adjacency_index: 1 })
				])
			]),
			availability(),
			{ myHolds: ['a1'], pending: ['a2'], sellableCategoryIds: new Set(['gold']) }
		);
		expect(views.map((v) => [v.id, v.status])).toEqual([
			['a1', 'mine'],
			['a2', 'pending']
		]);
	});
});

describe('rowsFromSeatViews', () => {
	function view(id: string, overrides: Partial<SeatView> = {}): SeatView {
		return {
			id,
			label: id.toUpperCase(),
			rowLabel: 'A',
			rowOrder: 0,
			number: null,
			adjacencyIndex: 0,
			isAccessible: false,
			isObstructedView: false,
			status: 'available',
			...overrides
		};
	}

	it('groups by rowLabel and sorts rows by rowOrder, then rowLabel', () => {
		const rows = rowsFromSeatViews([
			view('c1', { rowLabel: 'C', rowOrder: 2 }),
			view('a1', { rowLabel: 'A', rowOrder: 0 }),
			view('b1', { rowLabel: 'B', rowOrder: 1 }),
			// Same rowOrder as B: falls back to label comparison.
			view('bb1', { rowLabel: 'BB', rowOrder: 1 })
		]);
		expect(rows.map((r) => r.rowLabel)).toEqual(['A', 'B', 'BB', 'C']);
	});

	it('orders numeric row labels numerically when rowOrder ties (grid-editor venues)', () => {
		// Seats written through the grid editor all have row_order 0, so the
		// label tiebreak must not sort rows lexicographically (1, 10, 2, ...).
		const rows = rowsFromSeatViews([
			view('r10', { rowLabel: '10' }),
			view('r2', { rowLabel: '2' }),
			view('r1', { rowLabel: '1' }),
			view('r11', { rowLabel: '11' })
		]);
		expect(rows.map((r) => r.rowLabel)).toEqual(['1', '2', '10', '11']);
	});

	it('sorts seats within a row by adjacencyIndex, then number', () => {
		const rows = rowsFromSeatViews([
			view('a3', { adjacencyIndex: 2, number: 3 }),
			view('a1', { adjacencyIndex: 0, number: 1 }),
			view('a2', { adjacencyIndex: 1, number: 2 }),
			// Tied adjacency with a2: number decides.
			view('a0', { adjacencyIndex: 1, number: 0 })
		]);
		expect(rows).toHaveLength(1);
		expect(rows[0].seats.map((s) => s.id)).toEqual(['a1', 'a0', 'a2', 'a3']);
	});

	it('breaks full ties on the seat label with numeric-aware collation (A2 before A10)', () => {
		// number is null and adjacency ties: the label tiebreak must not put
		// "A10" before "A2" lexicographically.
		const rows = rowsFromSeatViews([
			view('x1', { label: 'A10' }),
			view('x2', { label: 'A2' }),
			view('x3', { label: 'A1' })
		]);
		expect(rows).toHaveLength(1);
		expect(rows[0].seats.map((s) => s.label)).toEqual(['A1', 'A2', 'A10']);
	});
});
