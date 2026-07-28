import { describe, it, expect } from 'vitest';
import { entryFor, selectSections } from './entries';
import type {
	CombinedTotalsSchema,
	CurrencyFinancialsSchema,
	EventFinancialsSchema,
	MembershipFinancialsSchema,
	OrganizationFinancialsSchema
} from '$lib/api/generated/types.gen';

function tickets(overrides: Partial<CurrencyFinancialsSchema> = {}): CurrencyFinancialsSchema {
	return {
		currency: 'EUR',
		gross: '100.00',
		refunds: '0.00',
		net: '100.00',
		net_taxable: '84.03',
		vat: '15.97',
		sold_count: 4,
		refunded_count: 0,
		rate_buckets: [],
		...overrides
	};
}

function memberships(
	overrides: Partial<MembershipFinancialsSchema> = {}
): MembershipFinancialsSchema {
	return {
		currency: 'EUR',
		gross: '50.00',
		platform_fee: '2.50',
		net: '50.00',
		payment_count: 5,
		refunded_amount: '0.00',
		...overrides
	};
}

function combined(overrides: Partial<CombinedTotalsSchema> = {}): CombinedTotalsSchema {
	return {
		currency: 'EUR',
		tickets_net: '100.00',
		memberships_net: '50.00',
		net: '150.00',
		...overrides
	};
}

function event(overrides: Partial<EventFinancialsSchema> = {}): EventFinancialsSchema {
	return {
		event_id: 'e1',
		event_name: 'Summer Gala',
		event_start: '2026-09-01T18:00:00Z',
		by_currency: [tickets()],
		...overrides
	};
}

function financials(
	overrides: Partial<OrganizationFinancialsSchema> = {}
): OrganizationFinancialsSchema {
	return {
		date_from: '2026-01-01',
		date_to: '2026-12-31',
		active_currency: 'EUR',
		available_currencies: ['EUR'],
		totals: [],
		events: [],
		memberships: [],
		combined_totals: [],
		...overrides
	};
}

describe('entryFor', () => {
	it('returns undefined for an empty list', () => {
		expect(entryFor([], 'EUR')).toBeUndefined();
	});

	it('matches the requested currency', () => {
		const eur = tickets({ currency: 'EUR' });
		const usd = tickets({ currency: 'USD' });
		expect(entryFor([usd, eur], 'EUR')).toBe(eur);
	});

	it('falls back to the first entry when the currency is absent or unknown', () => {
		const usd = tickets({ currency: 'USD' });
		expect(entryFor([usd], null)).toBe(usd);
		expect(entryFor([usd], 'GBP')).toBe(usd);
	});
});

describe('selectSections', () => {
	it('reports nothing while the data is still undefined, without claiming emptiness', () => {
		const sections = selectSections(undefined, 'EUR');
		expect(sections.totals).toBeUndefined();
		expect(sections.memberships).toBeUndefined();
		expect(sections.combined).toBeUndefined();
		expect(sections.nothingAtAll).toBe(false);
	});

	it('does NOT report "nothing at all" for a memberships-only organization', () => {
		const sections = selectSections(
			financials({ memberships: [memberships()], combined_totals: [combined()] }),
			'EUR'
		);
		expect(sections.nothingAtAll).toBe(false);
		expect(sections.memberships).toBeDefined();
		expect(sections.totals).toBeUndefined();
	});

	it('reports "nothing at all" only when there is no ticket money, no membership money and no events', () => {
		expect(selectSections(financials(), 'EUR').nothingAtAll).toBe(true);
	});

	it('does not report "nothing at all" when events exist but the currency has no figures', () => {
		const sections = selectSections(financials({ events: [event({ by_currency: [] })] }), 'EUR');
		expect(sections.nothingAtAll).toBe(false);
	});

	it('withholds the combined total when only ticket money exists', () => {
		const sections = selectSections(
			financials({ totals: [tickets()], combined_totals: [combined({ memberships_net: '0.00' })] }),
			'EUR'
		);
		expect(sections.totals).toBeDefined();
		expect(sections.combined).toBeUndefined();
	});

	it('withholds the combined total when only membership money exists', () => {
		const sections = selectSections(
			financials({
				memberships: [memberships()],
				combined_totals: [combined({ tickets_net: '0.00' })]
			}),
			'EUR'
		);
		expect(sections.memberships).toBeDefined();
		expect(sections.combined).toBeUndefined();
	});

	it('surfaces the combined total when both sides have money', () => {
		const sections = selectSections(
			financials({
				totals: [tickets()],
				memberships: [memberships()],
				combined_totals: [combined()]
			}),
			'EUR'
		);
		expect(sections.combined?.net).toBe('150.00');
	});

	it('narrows every section to the active currency', () => {
		const sections = selectSections(
			financials({
				available_currencies: ['EUR', 'USD'],
				totals: [tickets({ currency: 'EUR' }), tickets({ currency: 'USD', net: '999.00' })],
				memberships: [
					memberships({ currency: 'EUR' }),
					memberships({ currency: 'USD', net: '10.00' })
				],
				combined_totals: [combined({ currency: 'EUR' }), combined({ currency: 'USD', net: '9.00' })]
			}),
			'USD'
		);
		expect(sections.totals?.net).toBe('999.00');
		expect(sections.memberships?.net).toBe('10.00');
		expect(sections.combined?.net).toBe('9.00');
	});
});
