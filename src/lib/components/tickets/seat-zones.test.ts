import { describe, it, expect } from 'vitest';
import type {
	TicketTierSchema,
	TierSeatPricingSchema,
	ZoneAvailabilitySchema
} from '$lib/api/generated/types.gen';
import { isMappedBestAvailable, zoneOptions } from './seat-zones';

const pricing: TierSeatPricingSchema = {
	categories: [
		{ id: 'gold', name: 'Gold', color: '#f9b233', price: '80.00', available: true },
		{ id: 'silver', name: 'Silver', color: '#9ab2ff', price: '45.00', available: true }
	],
	unpainted: null
};

const zones: ZoneAvailabilitySchema[] = [
	{
		sector_id: 'sec-1',
		price_category_id: 'gold',
		free_seats: 10,
		largest_contiguous_block: 4,
		accessible_free_seats: 1
	},
	{
		sector_id: 'sec-1',
		price_category_id: 'silver',
		free_seats: 0,
		largest_contiguous_block: 0,
		accessible_free_seats: 0
	},
	// Same category painted in ANOTHER sector: must never leak into this
	// tier's options (zone rows are scoped per sector).
	{
		sector_id: 'sec-2',
		price_category_id: 'silver',
		free_seats: 50,
		largest_contiguous_block: 50,
		accessible_free_seats: 5
	}
];

describe('isMappedBestAvailable', () => {
	const tier = (overrides: Partial<TicketTierSchema>): TicketTierSchema =>
		({ seat_assignment_mode: 'best_available', ...overrides }) as TicketTierSchema;

	it('true only for best_available with a non-empty seat_pricing', () => {
		expect(isMappedBestAvailable(tier({ seat_pricing: pricing }))).toBe(true);
		expect(isMappedBestAvailable(tier({ seat_pricing: null }))).toBe(false);
		expect(isMappedBestAvailable(tier({ seat_pricing: { categories: [], unpainted: null } }))).toBe(
			false
		);
		expect(
			isMappedBestAvailable(tier({ seat_assignment_mode: 'user_choice', seat_pricing: pricing }))
		).toBe(false);
	});
});

describe('zoneOptions', () => {
	it('returns the tier zones in server order with prices and selectability', () => {
		const opts = zoneOptions(pricing, zones, 'sec-1', 2, false);
		expect(opts).toEqual([
			{
				id: 'gold',
				name: 'Gold',
				color: '#f9b233',
				price: '80.00',
				selectable: true,
				freeSeats: 10
			},
			{
				id: 'silver',
				name: 'Silver',
				color: '#9ab2ff',
				price: '45.00',
				selectable: false,
				freeSeats: 0
			}
		]);
	});

	it('compares largest_contiguous_block (not free_seats) against the quantity', () => {
		// 10 free seats but the longest run is 4: a 5-seat hold cannot succeed.
		const opts = zoneOptions(pricing, zones, 'sec-1', 5, false);
		expect(opts[0].selectable).toBe(false);
		expect(opts[0].freeSeats).toBe(10);
	});

	it('uses accessible_free_seats when accessible seating is required (no adjacency)', () => {
		expect(zoneOptions(pricing, zones, 'sec-1', 1, true)[0]).toMatchObject({
			selectable: true,
			freeSeats: 1
		});
		expect(zoneOptions(pricing, zones, 'sec-1', 2, true)[0].selectable).toBe(false);
	});

	it('stays selectable with unknown availability (snapshot not loaded — server is the authority)', () => {
		const opts = zoneOptions(pricing, null, 'sec-1', 3, false);
		expect(opts.every((o) => o.selectable)).toBe(true);
		expect(opts.every((o) => o.freeSeats === null)).toBe(true);
	});

	it('treats a loaded snapshot with no row for the zone as zeroes', () => {
		const opts = zoneOptions(pricing, [], 'sec-1', 1, false);
		expect(opts.every((o) => !o.selectable)).toBe(true);
		expect(opts.every((o) => o.freeSeats === 0)).toBe(true);
	});

	it('ignores rows from other sectors', () => {
		// silver is wide open in sec-2 but sold out in sec-1 — the tier's sector.
		const opts = zoneOptions(pricing, zones, 'sec-1', 1, false);
		expect(opts.find((o) => o.id === 'silver')?.selectable).toBe(false);
	});

	it('returns [] without pricing', () => {
		expect(zoneOptions(null, zones, 'sec-1', 1, false)).toEqual([]);
	});
});
