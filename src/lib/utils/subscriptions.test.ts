import { describe, it, expect } from 'vitest';
import {
	getAvailableActions,
	formatPlanPrice,
	getStatusConfig,
	getDateLine,
	getMemberActions,
	isWithinRevivalWindow,
	monthlyEquivalent,
	classifyPlanChange
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

function mySub(overrides: Partial<MySubscriptionSchema> = {}): MySubscriptionSchema {
	return {
		plan_id: 'p1',
		organization_id: 'o1',
		status: 'active',
		current_period_start: '2026-07-01T00:00:00Z',
		current_period_end: '2026-08-01T00:00:00Z',
		cancelled_at: null,
		pending_plan_id: null,
		expired_at: null,
		revival_deadline: null,
		id: 's1',
		cancel_at_period_end: false,
		created_at: '2026-07-01T00:00:00Z',
		updated_at: '2026-07-01T00:00:00Z',
		plan: {
			id: 'p1',
			tier_id: 't1',
			tier_name: 'Gold',
			name: 'Monthly',
			description: null,
			price: '10.00',
			currency: 'EUR',
			period_unit: 'month',
			period_count: 1,
			is_active: true,
			payment_method: 'online',
			sales_status: 'open'
		},
		organization_name: 'Org',
		organization_slug: 'org',
		organization_logo_url: null,
		...overrides
	};
}

const NOW = new Date('2026-07-26T12:00:00Z');

describe('getMemberActions', () => {
	it('offline subscriptions get no self-serve actions regardless of status', () => {
		for (const status of ['active', 'past_due', 'expired'] as const) {
			const sub = mySub({ status });
			sub.plan.payment_method = 'offline';
			expect(getMemberActions(sub, NOW)).toEqual({
				manageBilling: false,
				changePlan: false,
				cancel: false,
				revive: false
			});
		}
	});

	it('online active offers billing, change plan and cancel', () => {
		expect(getMemberActions(mySub(), NOW)).toEqual({
			manageBilling: true,
			changePlan: true,
			cancel: true,
			revive: false
		});
	});

	// BE preflight rejects change-plan while a change is already pending.
	it('online active with a pending plan change hides change plan only', () => {
		expect(getMemberActions(mySub({ pending_plan_id: 'p2' }), NOW).changePlan).toBe(false);
		expect(getMemberActions(mySub({ pending_plan_id: 'p2' }), NOW).cancel).toBe(true);
	});

	// BE preflight rejects change-plan AND cancel is redundant once renewal is off.
	it('online active scheduled to cancel keeps only manage billing', () => {
		expect(getMemberActions(mySub({ cancel_at_period_end: true }), NOW)).toEqual({
			manageBilling: true,
			changePlan: false,
			cancel: false,
			revive: false
		});
	});

	it('online past_due offers billing portal and cancel', () => {
		expect(getMemberActions(mySub({ status: 'past_due' }), NOW)).toEqual({
			manageBilling: true,
			changePlan: false,
			cancel: true,
			revive: false
		});
	});

	it('online expired inside the revival window offers revive only', () => {
		const sub = mySub({
			status: 'expired',
			expired_at: '2026-07-20T00:00:00Z',
			revival_deadline: '2026-08-19T00:00:00Z'
		});
		expect(getMemberActions(sub, NOW)).toEqual({
			manageBilling: false,
			changePlan: false,
			cancel: false,
			revive: true
		});
	});

	it('online expired past the deadline (or with none) offers nothing', () => {
		const past = mySub({ status: 'expired', revival_deadline: '2026-07-25T00:00:00Z' });
		const none = mySub({ status: 'expired', revival_deadline: null });
		const nothing = { manageBilling: false, changePlan: false, cancel: false, revive: false };
		expect(getMemberActions(past, NOW)).toEqual(nothing);
		expect(getMemberActions(none, NOW)).toEqual(nothing);
	});

	it('pending, paused and cancelled offer nothing', () => {
		for (const status of ['pending', 'paused', 'cancelled'] as const) {
			expect(getMemberActions(mySub({ status }), NOW)).toEqual({
				manageBilling: false,
				changePlan: false,
				cancel: false,
				revive: false
			});
		}
	});
});

describe('isWithinRevivalWindow', () => {
	it('is true strictly before the deadline, false at or after it', () => {
		const sub = { status: 'expired', revival_deadline: '2026-08-19T00:00:00Z' } as const;
		expect(isWithinRevivalWindow(sub, new Date('2026-08-18T23:59:59Z'))).toBe(true);
		expect(isWithinRevivalWindow(sub, new Date('2026-08-19T00:00:00Z'))).toBe(false);
	});

	it('is false for non-expired statuses and missing deadlines', () => {
		expect(
			isWithinRevivalWindow({ status: 'active', revival_deadline: '2099-01-01T00:00:00Z' }, NOW)
		).toBe(false);
		expect(isWithinRevivalWindow({ status: 'expired', revival_deadline: null }, NOW)).toBe(false);
	});
});

describe('classifyPlanChange (mirrors BE monthly-equivalent rule)', () => {
	const monthly10 = { price: '10.00', period_unit: 'month', period_count: 1 } as const;
	const yearly96 = { price: '96.00', period_unit: 'year', period_count: 1 } as const; // 8/mo
	const yearly150 = { price: '150.00', period_unit: 'year', period_count: 1 } as const; // 12.5/mo
	const biennial240 = { price: '240.00', period_unit: 'year', period_count: 2 } as const; // 10/mo
	const quarterly36 = { price: '36.00', period_unit: 'month', period_count: 3 } as const; // 12/mo

	it('normalizes cadence to per-month before comparing', () => {
		expect(monthlyEquivalent(yearly96)).toBeCloseTo(8);
		expect(classifyPlanChange(monthly10, yearly96)).toBe('downgrade'); // cheaper per month despite bigger headline
		expect(classifyPlanChange(monthly10, yearly150)).toBe('upgrade');
	});

	// period_count is a real multiplier, not decoration: drop it and a 2-year plan
	// reads as 20/mo instead of 10/mo, and a 3-month plan as 36/mo instead of 12/mo.
	it('divides by period_count as well as the unit', () => {
		expect(monthlyEquivalent(biennial240)).toBeCloseTo(10); // 240 / (12 * 2)
		expect(monthlyEquivalent(quarterly36)).toBeCloseTo(12); // 36 / (1 * 3)
		expect(classifyPlanChange(monthly10, biennial240)).toBe('downgrade'); // tie at 10/mo
		expect(classifyPlanChange(monthly10, quarterly36)).toBe('upgrade');
		expect(classifyPlanChange(quarterly36, biennial240)).toBe('downgrade');
	});

	it('defaults a missing period_count to 1', () => {
		expect(monthlyEquivalent({ price: '10.00', period_unit: 'month' })).toBeCloseTo(10);
	});

	it('a tie is a downgrade (strictly-greater is BE semantics)', () => {
		expect(
			classifyPlanChange(monthly10, { price: '120.00', period_unit: 'year', period_count: 1 })
		).toBe('downgrade');
	});
});
