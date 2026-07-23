import { describe, it, expect } from 'vitest';
import type {
	ChartSeatSchema,
	ChartSectorSchema,
	TierSeatPricingSchema,
	VenueChartSchema
} from '$lib/api/generated/types.gen';
import {
	estimatedSeatTotal,
	priceLegendEntries,
	resolveSeatPrice,
	sellableCategoryIds
} from './seat-pricing';

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

const pricing: TierSeatPricingSchema = {
	categories: [
		{ id: 'gold', name: 'Gold', color: '#f9b233', price: '50.00', available: true },
		{ id: 'silver', name: 'Silver', color: '#9ab2ff', price: '35.50', available: true },
		{ id: 'late', name: 'Late paint', color: '#e6332a', price: null, available: false }
	],
	unpainted: '20.00'
};

describe('resolveSeatPrice', () => {
	it('returns null without pricing (non-category tiers change nothing)', () => {
		expect(resolveSeatPrice(null, 'gold')).toBeNull();
		expect(resolveSeatPrice(undefined, null)).toBeNull();
	});

	it('resolves a painted seat to its category price', () => {
		expect(resolveSeatPrice(pricing, 'gold')).toEqual({
			price: '50.00',
			available: true,
			categoryName: 'Gold'
		});
	});

	it('falls back to the unpainted price for uncategorized seats', () => {
		expect(resolveSeatPrice(pricing, null)).toEqual({
			price: '20.00',
			available: true,
			categoryName: null
		});
	});

	it('marks unpainted seats unavailable when unpainted is null (mapped best-available tier)', () => {
		expect(resolveSeatPrice({ ...pricing, unpainted: null }, null)).toEqual({
			price: null,
			available: false,
			categoryName: null
		});
	});

	it('marks an unpriced (available=false) category unavailable', () => {
		expect(resolveSeatPrice(pricing, 'late')).toEqual({
			price: null,
			available: false,
			categoryName: 'Late paint'
		});
	});

	it('never guesses a price for a category the server did not list', () => {
		expect(resolveSeatPrice(pricing, 'unknown')).toEqual({
			price: null,
			available: false,
			categoryName: null
		});
	});
});

describe('sellableCategoryIds', () => {
	it('collects only categories with an honest price (allow-list)', () => {
		expect([...(sellableCategoryIds(pricing) ?? [])]).toEqual(['gold', 'silver']);
	});

	it('is null without pricing (flat tier — nothing category-blocked)', () => {
		expect(sellableCategoryIds(null)).toBeNull();
		expect(sellableCategoryIds(undefined)).toBeNull();
	});
});

describe('priceLegendEntries', () => {
	const testChart = chart([
		sector('s1', [
			seat('a1', { price_category_id: 'gold' }),
			seat('a2', { price_category_id: 'late' }),
			seat('a3')
		]),
		sector('s2', [seat('b1', { price_category_id: 'silver' })])
	]);

	it('scopes to the tier sector and appends the unpainted row', () => {
		const entries = priceLegendEntries(pricing, testChart, 's1');
		expect(entries.map((e) => [e.id, e.price, e.available])).toEqual([
			['gold', '50.00', true],
			['late', null, false],
			[null, '20.00', true]
		]);
	});

	it('covers all seated sectors when no sector is given', () => {
		const entries = priceLegendEntries(pricing, testChart, null);
		expect(entries.map((e) => e.id)).toEqual(['gold', 'silver', 'late', null]);
	});

	it('omits the unpainted row when every seat is painted', () => {
		const painted = chart([sector('s1', [seat('a1', { price_category_id: 'gold' })])]);
		expect(priceLegendEntries(pricing, painted, 's1').map((e) => e.id)).toEqual(['gold']);
	});

	it('skips inactive seats when deciding what appears', () => {
		const inactive = chart([
			sector('s1', [
				seat('a1', { price_category_id: 'gold' }),
				seat('a2', { is_active: false }) // would add the unpainted row
			])
		]);
		expect(priceLegendEntries(pricing, inactive, 's1').map((e) => e.id)).toEqual(['gold']);
	});

	it('is empty without pricing or chart', () => {
		expect(priceLegendEntries(null, testChart, 's1')).toEqual([]);
		expect(priceLegendEntries(pricing, null, 's1')).toEqual([]);
	});
});

describe('estimatedSeatTotal', () => {
	const testChart = chart([
		sector('s1', [
			seat('a1', { price_category_id: 'gold' }),
			seat('a2', { price_category_id: 'silver' }),
			seat('a3'),
			seat('a4', { price_category_id: 'late' })
		])
	]);

	it('sums resolved prices exactly (integer cents, no float drift)', () => {
		expect(estimatedSeatTotal(pricing, testChart, ['a1', 'a2', 'a3'])).toBe('105.50');
	});

	it('returns null for an empty selection or missing pricing', () => {
		expect(estimatedSeatTotal(pricing, testChart, [])).toBeNull();
		expect(estimatedSeatTotal(null, testChart, ['a1'])).toBeNull();
	});

	it('returns null when any selected seat has no honest price', () => {
		expect(estimatedSeatTotal(pricing, testChart, ['a1', 'a4'])).toBeNull();
	});

	it('returns null when a held seat is unknown to the chart', () => {
		expect(estimatedSeatTotal(pricing, testChart, ['ghost'])).toBeNull();
	});
});
