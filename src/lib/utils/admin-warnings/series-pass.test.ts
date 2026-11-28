import { describe, it, expect } from 'vitest';
import {
	passVisibleInRestrictedOrg,
	passSalesEndBeforeStart,
	passSalesStartTooLate,
	passFewUpcomingEvents,
	passOnlineWithoutStripe,
	passDiscountCoversPrice,
	passPriceAboveTiersSum
} from './series-pass';

const NOW = new Date('2026-06-01T12:00:00Z');
const past = '2026-05-01T10:00:00Z';
const d1 = '2026-07-01T10:00:00Z';
const d2 = '2026-08-01T10:00:00Z';
const d3 = '2026-09-01T10:00:00Z';
const base = { now: NOW, coveredEventStarts: [d1, d2, d3] };

describe('A3 passVisibleInRestrictedOrg', () => {
	const input = { ...base, organizationVisibility: 'members-only', visibility: 'public' };
	it('warns for a public pass in a restricted org', () => {
		const w = passVisibleInRestrictedOrg(input);
		expect(w?.id).toBe('A3');
		expect(w?.level).toBe('warn');
		expect(w?.title()).toBe('Pass that most people cannot see');
	});
	it('warns for unlisted and for private/staff-only orgs', () => {
		expect(passVisibleInRestrictedOrg({ ...input, visibility: 'unlisted' })).not.toBeNull();
		expect(
			passVisibleInRestrictedOrg({ ...input, organizationVisibility: 'staff-only' })
		).not.toBeNull();
		expect(
			passVisibleInRestrictedOrg({ ...input, organizationVisibility: 'private' })
		).not.toBeNull();
	});
	it('is silent for a public or unlisted org', () => {
		expect(passVisibleInRestrictedOrg({ ...input, organizationVisibility: 'public' })).toBeNull();
		expect(passVisibleInRestrictedOrg({ ...input, organizationVisibility: 'unlisted' })).toBeNull();
	});
	it('is silent for a restricted pass', () => {
		expect(passVisibleInRestrictedOrg({ ...input, visibility: 'members-only' })).toBeNull();
	});
	it('is silent for an inactive pass and when all events are past', () => {
		expect(passVisibleInRestrictedOrg({ ...input, is_active: false })).toBeNull();
		expect(passVisibleInRestrictedOrg({ ...input, coveredEventStarts: [past] })).toBeNull();
	});
	it('treats a missing is_active as active', () => {
		expect(passVisibleInRestrictedOrg({ ...input, is_active: undefined })).not.toBeNull();
	});
});

describe('E1a passSalesEndBeforeStart', () => {
	it('warns when end is before or equal to start', () => {
		const w = passSalesEndBeforeStart({
			...base,
			sales_start_at: '2026-06-10T10:00:00Z',
			sales_end_at: '2026-06-09T10:00:00Z'
		});
		expect(w?.id).toBe('E1-order');
		expect(w?.level).toBe('warn');
		expect(
			passSalesEndBeforeStart({
				...base,
				sales_start_at: '2026-06-10T10:00:00Z',
				sales_end_at: '2026-06-10T10:00:00Z'
			})
		).not.toBeNull();
	});
	it('is silent when end is after start, or a date is unset or invalid', () => {
		expect(
			passSalesEndBeforeStart({
				...base,
				sales_start_at: '2026-06-10T10:00:00Z',
				sales_end_at: '2026-06-11T10:00:00Z'
			})
		).toBeNull();
		expect(passSalesEndBeforeStart({ ...base, sales_start_at: '', sales_end_at: d1 })).toBeNull();
		expect(passSalesEndBeforeStart({ ...base, sales_start_at: d1, sales_end_at: null })).toBeNull();
		expect(passSalesEndBeforeStart({ ...base, sales_start_at: 'x', sales_end_at: d1 })).toBeNull();
	});
	it('is silent for an inactive pass and when all events are past', () => {
		const dates = { sales_start_at: d2, sales_end_at: d1 };
		expect(passSalesEndBeforeStart({ ...base, ...dates, is_active: false })).toBeNull();
		expect(passSalesEndBeforeStart({ ...base, ...dates, coveredEventStarts: [past] })).toBeNull();
	});
});

describe('E1b passSalesStartTooLate', () => {
	it('warns when sales start after the second-to-last upcoming event starts', () => {
		const w = passSalesStartTooLate({ ...base, sales_start_at: '2026-08-15T10:00:00Z' });
		expect(w?.id).toBe('E1-late');
		expect(w?.level).toBe('warn');
	});
	it('is silent when sales start before or at that event', () => {
		expect(passSalesStartTooLate({ ...base, sales_start_at: '2026-07-15T10:00:00Z' })).toBeNull();
		expect(passSalesStartTooLate({ ...base, sales_start_at: d2 })).toBeNull();
	});
	it('ignores past events and unsorted input', () => {
		const input = { ...base, coveredEventStarts: [d3, past, d1, d2] };
		expect(
			passSalesStartTooLate({ ...input, sales_start_at: '2026-08-15T10:00:00Z' })
		).not.toBeNull();
		expect(passSalesStartTooLate({ ...input, sales_start_at: '2026-07-15T10:00:00Z' })).toBeNull();
	});
	it('is silent with fewer than two upcoming events (E2 covers that)', () => {
		const input = {
			...base,
			coveredEventStarts: [past, d3],
			sales_start_at: '2026-12-01T00:00:00Z'
		};
		expect(passSalesStartTooLate(input)).toBeNull();
	});
	it('is silent without a sales start, for an inactive pass and when all events are past', () => {
		expect(passSalesStartTooLate({ ...base, sales_start_at: null })).toBeNull();
		expect(
			passSalesStartTooLate({ ...base, sales_start_at: '2026-12-01T00:00:00Z', is_active: false })
		).toBeNull();
		expect(
			passSalesStartTooLate({
				...base,
				coveredEventStarts: [past],
				sales_start_at: '2026-12-01T00:00:00Z'
			})
		).toBeNull();
	});
});

describe('E2 passFewUpcomingEvents', () => {
	it('warns with one upcoming event, also when others are past', () => {
		const w = passFewUpcomingEvents({ ...base, coveredEventStarts: [past, d1] });
		expect(w?.id).toBe('E2');
		expect(w?.level).toBe('warn');
		expect(passFewUpcomingEvents({ ...base, coveredEventStarts: [d1] })).not.toBeNull();
	});
	it('warns for an active pass with no covered event (0 links)', () => {
		expect(passFewUpcomingEvents({ ...base, coveredEventStarts: [] })).not.toBeNull();
	});
	it('is silent with two upcoming events', () => {
		expect(passFewUpcomingEvents({ ...base, coveredEventStarts: [d1, d2] })).toBeNull();
	});
	it('is silent for an inactive pass and when all events are past', () => {
		expect(
			passFewUpcomingEvents({ ...base, coveredEventStarts: [d1], is_active: false })
		).toBeNull();
		expect(passFewUpcomingEvents({ ...base, coveredEventStarts: [past, past] })).toBeNull();
	});
	it('counts an event that starts exactly now as past', () => {
		expect(passFewUpcomingEvents({ ...base, coveredEventStarts: [NOW, d1] })).not.toBeNull();
	});
});

describe('E3 passOnlineWithoutStripe', () => {
	const input = { ...base, payment_method: 'online', organizationStripeConnected: false };
	it('warns for online payment without Stripe', () => {
		const w = passOnlineWithoutStripe(input);
		expect(w?.id).toBe('E3');
		expect(w?.level).toBe('warn');
	});
	it('is silent with Stripe, or another payment method', () => {
		expect(passOnlineWithoutStripe({ ...input, organizationStripeConnected: true })).toBeNull();
		expect(passOnlineWithoutStripe({ ...input, payment_method: 'offline' })).toBeNull();
	});
	it('is silent for an inactive pass and when all events are past', () => {
		expect(passOnlineWithoutStripe({ ...input, is_active: false })).toBeNull();
		expect(passOnlineWithoutStripe({ ...input, coveredEventStarts: [past] })).toBeNull();
	});
});

describe('E4a passDiscountCoversPrice', () => {
	const input = { ...base, price: '30.00', pro_rata_discount: '30' };
	it('is info and fires when discount x (covered - 2) reaches the price', () => {
		const w = passDiscountCoversPrice(input);
		expect(w?.id).toBe('E4a');
		expect(w?.level).toBe('info');
		expect(
			passDiscountCoversPrice({
				...input,
				pro_rata_discount: '10',
				coveredEventStarts: [d1, d2, d3, d3, d3]
			})
		).not.toBeNull();
	});
	it('is silent below the price', () => {
		expect(passDiscountCoversPrice({ ...input, pro_rata_discount: '29.99' })).toBeNull();
	});
	it('is silent with exactly 2 covered events', () => {
		expect(passDiscountCoversPrice({ ...input, coveredEventStarts: [d1, d2] })).toBeNull();
	});
	it('is silent for a free pass or a zero discount', () => {
		expect(passDiscountCoversPrice({ ...input, price: '0' })).toBeNull();
		expect(passDiscountCoversPrice({ ...input, pro_rata_discount: '0' })).toBeNull();
		expect(passDiscountCoversPrice({ ...input, pro_rata_discount: '' })).toBeNull();
	});
	it('parses form strings with a comma, and numbers', () => {
		expect(
			passDiscountCoversPrice({ ...input, price: '30,00', pro_rata_discount: '30,5' })
		).not.toBeNull();
		expect(passDiscountCoversPrice({ ...input, price: 30, pro_rata_discount: 30 })).not.toBeNull();
		expect(passDiscountCoversPrice({ ...input, price: 'abc' })).toBeNull();
	});
	it('is silent for an inactive pass and when all events are past', () => {
		expect(passDiscountCoversPrice({ ...input, is_active: false })).toBeNull();
		expect(
			passDiscountCoversPrice({ ...input, coveredEventStarts: [past, past, past] })
		).toBeNull();
	});
});

describe('E4b passPriceAboveTiersSum', () => {
	const tier = (price: string, currency = 'EUR') => ({ price, currency });
	const input = {
		...base,
		price: '50',
		currency: 'EUR',
		selectedTiers: [tier('10'), tier('15'), tier('20')]
	};
	it('is info and fires when the price is above the sum', () => {
		const w = passPriceAboveTiersSum(input);
		expect(w?.id).toBe('E4b');
		expect(w?.level).toBe('info');
	});
	it('is silent when the price equals or is below the sum', () => {
		expect(passPriceAboveTiersSum({ ...input, price: '45' })).toBeNull();
		expect(passPriceAboveTiersSum({ ...input, price: '44' })).toBeNull();
	});
	it('is silent with fewer than two selections', () => {
		expect(passPriceAboveTiersSum({ ...input, selectedTiers: [tier('10')] })).toBeNull();
		expect(passPriceAboveTiersSum({ ...input, selectedTiers: [] })).toBeNull();
	});
	it('is silent when a tier is not loaded', () => {
		expect(passPriceAboveTiersSum({ ...input, selectedTiers: [tier('1'), null] })).toBeNull();
		expect(passPriceAboveTiersSum({ ...input, selectedTiers: [tier('1'), undefined] })).toBeNull();
	});
	it('is silent with mixed currency, compared case-insensitively', () => {
		expect(
			passPriceAboveTiersSum({ ...input, selectedTiers: [tier('1'), tier('1', 'USD')] })
		).toBeNull();
		expect(passPriceAboveTiersSum({ ...input, currency: 'eur' })).not.toBeNull();
		expect(passPriceAboveTiersSum({ ...input, currency: 'USD' })).toBeNull();
	});
	it('is silent for an inactive pass and when all events are past', () => {
		expect(passPriceAboveTiersSum({ ...input, is_active: false })).toBeNull();
		expect(passPriceAboveTiersSum({ ...input, coveredEventStarts: [past, past] })).toBeNull();
	});
});
