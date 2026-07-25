import { describe, it, expect } from 'vitest';
import type { SeatingAvailabilitySchema, VenueChartSchema } from '$lib/api/generated/types.gen';
import { reseatTargetSeatIds, seatCategoryMap } from './reseat-model';

function chart(): VenueChartSchema {
	return {
		venue_id: 'venue-1',
		venue_name: 'Test Hall',
		updated_at: '2026-07-19T00:00:00Z',
		price_categories: [],
		sectors: [
			{
				id: 'sec-stalls',
				name: 'Stalls',
				kind: 'seated',
				display_order: 0,
				seats: [
					{ id: 's1', label: 'A1', row_label: 'A', number: 1, price_category_id: 'cat-a' },
					{ id: 's2', label: 'A2', row_label: 'A', number: 2, price_category_id: 'cat-a' },
					{ id: 's3', label: 'A3', row_label: 'A', number: 3, price_category_id: 'cat-a' },
					{ id: 's4', label: 'B1', row_label: 'B', number: 1, price_category_id: 'cat-b' },
					{
						id: 's-dead',
						label: 'B2',
						row_label: 'B',
						number: 2,
						price_category_id: 'cat-a',
						is_active: false
					}
				]
			}
		]
	};
}

function availability(seats: Record<string, string> = {}): SeatingAvailabilitySchema {
	return { seats, standing: {}, my_holds: [], my_holds_expire_at: null };
}

describe('seatCategoryMap', () => {
	it('maps active seats to their category and skips inactive seats', () => {
		const map = seatCategoryMap(chart());
		expect(map.get('s1')).toBe('cat-a');
		expect(map.get('s4')).toBe('cat-b');
		expect(map.has('s-dead')).toBe(false);
	});
});

describe('reseatTargetSeatIds', () => {
	it('returns free seats in the same category, excluding the current seat', () => {
		// current seat s1 is cat-a; s2 free (cat-a), s3 sold (cat-a), s4 free but cat-b
		const eligible = reseatTargetSeatIds(chart(), availability({ s3: 'sold' }), 's1');
		expect([...eligible].sort()).toEqual(['s2']);
	});

	it('excludes seats that are held or blocked', () => {
		const eligible = reseatTargetSeatIds(
			chart(),
			availability({ s2: 'held', s3: 'blocked' }),
			's1'
		);
		expect(eligible.size).toBe(0);
	});

	it('never offers a different price category', () => {
		// current s4 is cat-b; only cat-b free seats qualify, and there are none
		const eligible = reseatTargetSeatIds(chart(), availability(), 's4');
		expect(eligible.size).toBe(0);
	});

	it('returns empty when the current seat is missing or unknown', () => {
		expect(reseatTargetSeatIds(chart(), availability(), null).size).toBe(0);
		expect(reseatTargetSeatIds(chart(), availability(), 'ghost').size).toBe(0);
	});
});
