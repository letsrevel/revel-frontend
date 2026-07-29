import { describe, it, expect } from 'vitest';
import { minimumTierPrice } from './pricing';
import type { TicketTierSchema } from '$lib/api/generated/types.gen';

function tier(overrides: Partial<TicketTierSchema>): TicketTierSchema {
	return {
		id: 'tier-1',
		event_id: 'event-1',
		name: 'General',
		price: '10.00',
		currency: 'EUR',
		total_available: null,
		seat_assignment_mode: 'automatic',
		...overrides
	} as TicketTierSchema;
}

describe('minimumTierPrice', () => {
	it('returns null when there are no tiers (no price is not the same as free)', () => {
		expect(minimumTierPrice([])).toBeNull();
	});

	it('picks the cheapest tier and reports its currency', () => {
		expect(
			minimumTierPrice([
				tier({ id: 'a', price: '25.00', currency: 'EUR' }),
				tier({ id: 'b', price: '12.50', currency: 'EUR' }),
				tier({ id: 'c', price: '40.00', currency: 'EUR' })
			])
		).toEqual({ amount: 12.5, currency: 'EUR' });
	});

	it('reads the floor of a pay-what-you-can tier', () => {
		expect(
			minimumTierPrice([tier({ price: '0.00', price_type: 'pwyc', pwyc_min: '5.00' })])
		).toEqual({ amount: 5, currency: 'EUR' });
	});

	it('treats a pay-what-you-can tier with no floor as zero', () => {
		expect(minimumTierPrice([tier({ price_type: 'pwyc', pwyc_min: undefined })])).toEqual({
			amount: 0,
			currency: 'EUR'
		});
	});

	it('skips tiers the backend says cannot be purchased', () => {
		expect(
			minimumTierPrice([
				tier({ id: 'a', price: '5.00', can_purchase: false }),
				tier({ id: 'b', price: '20.00', can_purchase: true })
			])
		).toEqual({ amount: 20, currency: 'EUR' });
	});

	it('returns null when every tier is unpurchasable', () => {
		expect(minimumTierPrice([tier({ can_purchase: false })])).toBeNull();
	});

	it('ignores an unparseable price rather than rendering NaN', () => {
		expect(
			minimumTierPrice([tier({ id: 'a', price: 'free' }), tier({ id: 'b', price: '9.00' })])
		).toEqual({ amount: 9, currency: 'EUR' });
	});

	it('keeps a genuinely free tier at zero', () => {
		expect(minimumTierPrice([tier({ price: '0.00' })])).toEqual({ amount: 0, currency: 'EUR' });
	});
});
