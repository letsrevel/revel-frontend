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
	is_active: true,
	payment_method: 'offline'
} as PlanSchema;

interface MakeSubOptions extends Partial<MySubscriptionSchema> {
	status: MySubscriptionSchema['status'];
	payment_method?: 'online' | 'offline';
}

function makeSub({
	status,
	payment_method = 'offline',
	...over
}: MakeSubOptions): MySubscriptionSchema {
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
		plan: { ...basePlan, payment_method },
		organization_name: 'Sunset Yoga',
		organization_slug: 'sunset-yoga',
		organization_logo_url: null,
		...over
	} as MySubscriptionSchema;
}

describe('getAvailableActions', () => {
	it.each([
		['pending', { recordPayment: true, pause: false, resume: false, cancel: true, revive: false }],
		['active', { recordPayment: true, pause: true, resume: false, cancel: true, revive: false }],
		['past_due', { recordPayment: true, pause: false, resume: false, cancel: true, revive: false }],
		['paused', { recordPayment: false, pause: false, resume: true, cancel: true, revive: false }],
		[
			'cancelled',
			{ recordPayment: false, pause: false, resume: false, cancel: false, revive: false }
		],
		['expired', { recordPayment: false, pause: false, resume: false, cancel: false, revive: true }]
	])('returns the right action set for %s', (status, expected) => {
		expect(getAvailableActions(makeSub({ status: status as never }))).toEqual(expected);
	});
});

describe('getAvailableActions online/offline', () => {
	it('offers recordPayment for offline active subs only', () => {
		expect(
			getAvailableActions(makeSub({ status: 'active', payment_method: 'offline' })).recordPayment
		).toBe(true);
		expect(
			getAvailableActions(makeSub({ status: 'active', payment_method: 'online' })).recordPayment
		).toBe(false);
	});

	it('offers revive only for expired subs, any payment method', () => {
		expect(
			getAvailableActions(makeSub({ status: 'expired', payment_method: 'offline' })).revive
		).toBe(true);
		expect(
			getAvailableActions(makeSub({ status: 'expired', payment_method: 'online' })).revive
		).toBe(true);
		expect(
			getAvailableActions(makeSub({ status: 'active', payment_method: 'offline' })).revive
		).toBe(false);
		expect(
			getAvailableActions(makeSub({ status: 'cancelled', payment_method: 'online' })).revive
		).toBe(false);
	});

	it('keeps pause/resume/cancel identical across payment methods', () => {
		for (const pm of ['online', 'offline'] as const) {
			const active = getAvailableActions(makeSub({ status: 'active', payment_method: pm }));
			expect(active).toMatchObject({ pause: true, resume: false, cancel: true });
			const paused = getAvailableActions(makeSub({ status: 'paused', payment_method: pm }));
			expect(paused).toMatchObject({ pause: false, resume: true, cancel: true });
		}
	});
});

describe('formatPlanPrice', () => {
	it('formats monthly', () => {
		expect(formatPlanPrice(basePlan)).toBe('€10.00 / month');
	});
	it('formats annual', () => {
		expect(formatPlanPrice({ ...basePlan, period_unit: 'year', period_count: 1 })).toBe(
			'€10.00 / year'
		);
	});
	it('formats N-month', () => {
		expect(formatPlanPrice({ ...basePlan, period_count: 3 })).toBe('€10.00 / 3 months');
	});
	it('formats N-year', () => {
		expect(formatPlanPrice({ ...basePlan, period_unit: 'year', period_count: 2 })).toBe(
			'€10.00 / 2 years'
		);
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
		const line = getDateLine(makeSub({ status: 'active' }));
		expect(line.kind).toBe('renewal');
	});
	it('active + cancel_at_period_end → "Cancels on …"', () => {
		const line = getDateLine(makeSub({ status: 'active', cancel_at_period_end: true }));
		expect(line.kind).toBe('cancels');
	});
	it('past_due → "Period ends …"', () => {
		const line = getDateLine(makeSub({ status: 'past_due' }));
		expect(line.kind).toBe('period_ends');
	});
	it('paused → "Paused since …"', () => {
		const line = getDateLine(makeSub({ status: 'paused' }));
		expect(line.kind).toBe('paused_since');
	});
	it('cancelled → "Ended …"', () => {
		const line = getDateLine(
			makeSub({ status: 'cancelled', cancelled_at: '2026-05-01T00:00:00Z' })
		);
		expect(line.kind).toBe('ended');
	});
	it('expired → "Ended …"', () => {
		expect(getDateLine(makeSub({ status: 'expired' })).kind).toBe('ended');
	});
	it('pending → kind: pending', () => {
		expect(getDateLine(makeSub({ status: 'pending' })).kind).toBe('pending');
	});
});
