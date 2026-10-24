import { describe, expect, it } from 'vitest';
import type { EventInListSchema } from '$lib/api/generated/types.gen';
import { billingNeedsAttention, buildDashboardModel } from './dashboard-model';

const NOW = new Date('2026-10-24T20:00:00Z');
const h = (hours: number): string => new Date(NOW.getTime() + hours * 3600_000).toISOString();

function ev(id: string, startH: number, endH: number, extra: Partial<EventInListSchema> = {}) {
	return {
		id,
		name: id,
		status: 'open',
		is_template: false,
		start: h(startH),
		end: h(endH),
		...extra
	} as EventInListSchema;
}

describe('buildDashboardModel', () => {
	it('keeps a running event and drops an ended one', () => {
		const m = buildDashboardModel([ev('ended', -10, -2), ev('running', -1, 3)], NOW);
		expect(m.live.map((e) => e.id)).toEqual(['running']);
		expect(m.nextEvent?.id).toBe('running');
		expect(m.isHappeningNow).toBe(true);
	});

	it('is not happening now for a future event', () => {
		const m = buildDashboardModel([ev('later', 5, 8)], NOW);
		expect(m.isHappeningNow).toBe(false);
	});

	it('skips cancelled events for nextEvent but keeps them in upcoming', () => {
		const m = buildDashboardModel(
			[ev('c', 1, 2, { status: 'cancelled' }), ev('o', 3, 4), ev('d', 5, 6, { status: 'draft' })],
			NOW
		);
		expect(m.nextEvent?.id).toBe('o');
		expect(m.upcoming.map((e) => e.id)).toEqual(['c', 'd']);
	});

	it('allows a draft as nextEvent', () => {
		const m = buildDashboardModel([ev('d', 1, 2, { status: 'draft' })], NOW);
		expect(m.nextEvent?.id).toBe('d');
	});

	it('sorts by start and ignores templates', () => {
		const m = buildDashboardModel(
			[ev('b', 20, 22), ev('t', 1, 2, { is_template: true }), ev('a', 10, 12)],
			NOW
		);
		expect(m.live.map((e) => e.id)).toEqual(['a', 'b']);
	});

	it('caps upcoming at 6', () => {
		const events = Array.from({ length: 10 }, (_, i) => ev(`e${i}`, i + 1, i + 2));
		const m = buildDashboardModel(events, NOW);
		expect(m.upcoming).toHaveLength(6);
		expect(m.upcoming[0].id).toBe('e1');
	});

	it('counts live drafts only', () => {
		const m = buildDashboardModel(
			[
				ev('d1', 1, 2, { status: 'draft' }),
				ev('d2', 3, 4, { status: 'draft' }),
				ev('old', -5, -4, { status: 'draft' }),
				ev('o', 5, 6)
			],
			NOW
		);
		expect(m.draftCount).toBe(2);
	});

	it('returns an empty model for no events', () => {
		const m = buildDashboardModel([], NOW);
		expect(m.nextEvent).toBeNull();
		expect(m.isHappeningNow).toBe(false);
		expect(m.upcoming).toEqual([]);
	});
});

describe('billingNeedsAttention', () => {
	const base = {
		is_stripe_connected: true,
		platform_fee_percent: '2.5',
		platform_fee_fixed: '0',
		vat_country_code: 'IT',
		billing_address: 'Via Roma 1',
		billing_name: 'Acme'
	};
	it('is false when details are complete', () => {
		expect(billingNeedsAttention(base)).toBe(false);
	});
	it('is true when a field is missing', () => {
		expect(billingNeedsAttention({ ...base, billing_name: '' })).toBe(true);
		expect(billingNeedsAttention({ ...base, vat_country_code: '' })).toBe(true);
		expect(billingNeedsAttention({ ...base, billing_address: '' })).toBe(true);
	});
	it('is false without stripe or without fees', () => {
		expect(billingNeedsAttention({ ...base, billing_name: '', is_stripe_connected: false })).toBe(
			false
		);
		expect(
			billingNeedsAttention({
				...base,
				billing_name: '',
				platform_fee_percent: '0',
				platform_fee_fixed: '0.00'
			})
		).toBe(false);
	});
	it('is true with only a fixed fee', () => {
		expect(
			billingNeedsAttention({
				...base,
				billing_name: '',
				platform_fee_percent: '0',
				platform_fee_fixed: '0.30'
			})
		).toBe(true);
	});
});
