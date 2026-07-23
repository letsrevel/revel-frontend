import { describe, it, expect } from 'vitest';
import type { TicketTierDetailSchema, VenueChartSchema } from '$lib/api/generated/types.gen';
import {
	BOX_OFFICE_PAYMENT_METHODS,
	buildSellRequest,
	isSellableStatus,
	seatPriceCategoryId,
	seatSectorId,
	tiersForSeat
} from './box-office-model';

function chart(): VenueChartSchema {
	return {
		venue_id: 'venue-1',
		venue_name: 'Test Hall',
		updated_at: '2026-07-19T00:00:00Z',
		price_categories: [
			{ id: 'cat-premium', name: 'Premium', color: '#f00' },
			{ id: 'cat-standard', name: 'Standard', color: '#0f0' }
		],
		sectors: [
			{
				id: 'sec-stalls',
				name: 'Stalls',
				kind: 'seated',
				display_order: 0,
				seats: [
					{ id: 's1', label: 'A1', row_label: 'A', number: 1, price_category_id: 'cat-premium' },
					{ id: 's2', label: 'A2', row_label: 'A', number: 2, price_category_id: 'cat-standard' }
				]
			},
			{
				id: 'sec-balcony',
				name: 'Balcony',
				kind: 'seated',
				display_order: 1,
				seats: [{ id: 'b1', label: 'C1', row_label: 'C', number: 1 }]
			}
		]
	};
}

function tier(overrides: Partial<TicketTierDetailSchema>): TicketTierDetailSchema {
	return {
		event_id: 'evt-1',
		seat_assignment_mode: 'user_choice',
		name: 'Tier',
		...overrides
	} as TicketTierDetailSchema;
}

describe('buildSellRequest', () => {
	const base = {
		seatId: 's1',
		tierId: 't1',
		paymentMethod: 'at_the_door' as const,
		email: 'guest@example.com',
		firstName: '',
		lastName: ''
	};

	it('builds a minimal at-the-door payload from seat, tier, method and email', () => {
		expect(buildSellRequest(base)).toEqual({
			seat_id: 's1',
			tier_id: 't1',
			payment_method: 'at_the_door',
			email: 'guest@example.com'
		});
	});

	it('includes trimmed first/last names only when present', () => {
		expect(buildSellRequest({ ...base, firstName: '  Ada ', lastName: ' Lovelace ' })).toEqual({
			seat_id: 's1',
			tier_id: 't1',
			payment_method: 'at_the_door',
			email: 'guest@example.com',
			first_name: 'Ada',
			last_name: 'Lovelace'
		});
	});

	it('supports the comp (free) payment method', () => {
		expect(buildSellRequest({ ...base, paymentMethod: 'free' })?.payment_method).toBe('free');
	});

	it('rejects payment methods outside the box-office set', () => {
		// @ts-expect-error — guarding the runtime restriction against 'online'/'offline'
		expect(buildSellRequest({ ...base, paymentMethod: 'online' })).toBeNull();
		// @ts-expect-error — offline is not a valid box-office payment method
		expect(buildSellRequest({ ...base, paymentMethod: 'offline' })).toBeNull();
	});

	it('returns null without a seat or tier', () => {
		expect(buildSellRequest({ ...base, seatId: null })).toBeNull();
		expect(buildSellRequest({ ...base, tierId: null })).toBeNull();
	});

	it('returns null for a blank or malformed email', () => {
		expect(buildSellRequest({ ...base, email: '' })).toBeNull();
		expect(buildSellRequest({ ...base, email: '   ' })).toBeNull();
		expect(buildSellRequest({ ...base, email: 'not-an-email' })).toBeNull();
	});

	it('exposes exactly the two door payment methods', () => {
		expect(BOX_OFFICE_PAYMENT_METHODS).toEqual(['at_the_door', 'free']);
	});
});

describe('isSellableStatus', () => {
	it('allows free seats and held box-office overrides, not sold or foreign holds', () => {
		expect(isSellableStatus('available')).toBe(true);
		expect(isSellableStatus('blocked')).toBe(true);
		expect(isSellableStatus('sold')).toBe(false);
		expect(isSellableStatus('held')).toBe(false);
	});
});

describe('seat lookups', () => {
	it('resolves a seat to its sector and price category', () => {
		expect(seatSectorId(chart(), 's1')).toBe('sec-stalls');
		expect(seatPriceCategoryId(chart(), 's1')).toBe('cat-premium');
		expect(seatPriceCategoryId(chart(), 's2')).toBe('cat-standard');
		expect(seatPriceCategoryId(chart(), 'b1')).toBeNull();
	});

	it('returns null for an unknown seat', () => {
		expect(seatSectorId(chart(), 'nope')).toBeNull();
		expect(seatPriceCategoryId(chart(), 'nope')).toBeNull();
	});
});

describe('tiersForSeat', () => {
	// Pricing convergence: a tier's sellable categories are its non-empty
	// `category_prices` keys (the FK is gone). A mapped best_available tier
	// additionally never sells UNPAINTED seats (pool filtered to the zone).
	const premium = tier({
		id: 't-premium',
		name: 'Premium',
		seat_assignment_mode: 'best_available',
		category_prices: { 'cat-premium': '80.00' }
	});
	const standard = tier({
		id: 't-standard',
		name: 'Standard',
		seat_assignment_mode: 'best_available',
		category_prices: { 'cat-standard': '45.00' }
	});
	const balconyOnly = tier({
		id: 't-balcony',
		name: 'Balcony',
		sector: { name: 'Balcony', id: 'sec-balcony' }
	});
	const venueWide = tier({ id: 't-any', name: 'Any seat' });
	const generalAdmission = tier({ id: 't-ga', name: 'GA', seat_assignment_mode: 'none' });
	const all = [premium, standard, balconyOnly, venueWide, generalAdmission];

	it('drops general-admission (non-seated) tiers', () => {
		expect(tiersForSeat(all, null).map((t) => t.id)).toEqual([
			't-premium',
			't-standard',
			't-balcony',
			't-any'
		]);
	});

	it('matches a category-priced tier and the venue-wide tier for a premium seat', () => {
		const result = tiersForSeat(all, { sectorId: 'sec-stalls', categoryId: 'cat-premium' });
		expect(result.map((t) => t.id)).toEqual(['t-premium', 't-any']);
	});

	it('matches a sector-bound tier and the venue-wide tier for a balcony seat (mapped best_available never sells unpainted seats)', () => {
		const result = tiersForSeat(all, { sectorId: 'sec-balcony', categoryId: null });
		expect(result.map((t) => t.id)).toEqual(['t-balcony', 't-any']);
	});

	it('a mapped user_choice tier still sells unpainted seats (flat fallback), best_available does not', () => {
		const userChoicePriced = tier({
			id: 't-uc',
			name: 'UC priced',
			seat_assignment_mode: 'user_choice',
			category_prices: { 'cat-premium': '80.00' }
		});
		const result = tiersForSeat([premium, userChoicePriced], {
			sectorId: 'sec-stalls',
			categoryId: null
		});
		expect(result.map((t) => t.id)).toEqual(['t-uc']);
	});

	it('falls back to all seated tiers when nothing matches', () => {
		const result = tiersForSeat([premium, standard], {
			sectorId: 'sec-balcony',
			categoryId: null
		});
		expect(result.map((t) => t.id)).toEqual(['t-premium', 't-standard']);
	});
});
