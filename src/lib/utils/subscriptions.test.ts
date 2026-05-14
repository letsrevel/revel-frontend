import { describe, it, expect } from 'vitest';
import {
	getAvailableActions,
	formatPlanPrice,
	getStatusConfig,
	getDateLine
} from './subscriptions';
import type { MySubscriptionSchema, PlanSchema } from '$lib/api/generated/types.gen';

const basePlan: PlanSchema = {
	id: 'p1',
	tier_id: 't1',
	name: 'Gold Monthly',
	description: '',
	price: '10.00',
	currency: 'EUR',
	period_unit: 'month',
	period_count: 1,
	is_active: true
} as PlanSchema;

function makeSub(
	status: MySubscriptionSchema['status'],
	over: Partial<MySubscriptionSchema> = {}
): MySubscriptionSchema {
	return {
		id: 's1',
		plan_id: 'p1',
		organization_id: 'o1',
		status,
		current_period_start: null,
		current_period_end: '2026-06-14T00:00:00Z',
		cancel_at_period_end: false,
		cancelled_at: null,
		created_at: '2026-05-14T00:00:00Z',
		updated_at: '2026-05-14T00:00:00Z',
		plan: basePlan,
		organization_name: 'Sunset Yoga',
		organization_slug: 'sunset-yoga',
		organization_logo_url: null,
		...over
	} as MySubscriptionSchema;
}

describe('getAvailableActions', () => {
	it.each([
		['pending', { recordPayment: true, pause: false, resume: false, cancel: true }],
		['active', { recordPayment: true, pause: true, resume: false, cancel: true }],
		['past_due', { recordPayment: true, pause: false, resume: false, cancel: true }],
		['paused', { recordPayment: false, pause: false, resume: true, cancel: true }],
		['cancelled', { recordPayment: false, pause: false, resume: false, cancel: false }],
		['expired', { recordPayment: false, pause: false, resume: false, cancel: false }]
	])('returns the right action set for %s', (status, expected) => {
		expect(getAvailableActions(makeSub(status as never))).toEqual(expected);
	});
});

describe('formatPlanPrice', () => {
	it('formats monthly', () => {
		expect(formatPlanPrice(basePlan, 'en')).toBe('€10.00 / month');
	});
	it('formats annual', () => {
		expect(
			formatPlanPrice({ ...basePlan, period_unit: 'year', period_count: 1 }, 'en')
		).toBe('€10.00 / year');
	});
	it('formats N-month', () => {
		expect(formatPlanPrice({ ...basePlan, period_count: 3 }, 'en')).toBe('€10.00 / 3 months');
	});
	it('formats N-year', () => {
		expect(
			formatPlanPrice({ ...basePlan, period_unit: 'year', period_count: 2 }, 'en')
		).toBe('€10.00 / 2 years');
	});
});

describe('getStatusConfig', () => {
	it.each([
		['active', 'green'],
		['pending', 'blue'],
		['past_due', 'amber'],
		['paused', 'gray'],
		['cancelled', 'muted'],
		['expired', 'red']
	])('maps %s to %s tone', (status, tone) => {
		expect(getStatusConfig(status as never).tone).toBe(tone);
	});
});

describe('getDateLine', () => {
	it('active → "Next renewal: …"', () => {
		const line = getDateLine(makeSub('active'));
		expect(line.kind).toBe('renewal');
	});
	it('active + cancel_at_period_end → "Cancels on …"', () => {
		const line = getDateLine(makeSub('active', { cancel_at_period_end: true }));
		expect(line.kind).toBe('cancels');
	});
	it('past_due → "Period ends …"', () => {
		const line = getDateLine(makeSub('past_due'));
		expect(line.kind).toBe('period_ends');
	});
	it('paused → "Paused since …"', () => {
		const line = getDateLine(makeSub('paused'));
		expect(line.kind).toBe('paused_since');
	});
	it('cancelled → "Ended …"', () => {
		const line = getDateLine(makeSub('cancelled', { cancelled_at: '2026-05-01T00:00:00Z' }));
		expect(line.kind).toBe('ended');
	});
	it('expired → "Ended …"', () => {
		expect(getDateLine(makeSub('expired')).kind).toBe('ended');
	});
	it('pending → kind: pending', () => {
		expect(getDateLine(makeSub('pending')).kind).toBe('pending');
	});
});
