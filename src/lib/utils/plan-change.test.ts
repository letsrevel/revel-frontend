import { describe, expect, it } from 'vitest';
import type { PlanSchema, SubscriptionSchema } from '$lib/api/generated/types.gen';
import {
	changePlanState,
	eligibleChangePlans,
	groupPlansByTier,
	isPlanSoldOut,
	planChangeErrorMessage,
	planChangeRefusalCode
} from './plan-change';

function plan(overrides: Partial<PlanSchema> = {}): PlanSchema {
	return {
		id: 'p1',
		tier_id: 't1',
		tier_name: 'Gold',
		name: 'Monthly',
		price: '10.00',
		currency: 'EUR',
		period_unit: 'month',
		period_count: 1,
		payment_method: 'offline',
		sales_status: 'open',
		active_subscription_count: 0,
		is_active: true,
		...overrides
	} as PlanSchema;
}

function sub(status: SubscriptionSchema['status'], p: PlanSchema = plan()) {
	return { status, plan: p } as Pick<SubscriptionSchema, 'status' | 'plan'>;
}

describe('changePlanState', () => {
	it.each(['pending', 'active', 'past_due'] as const)('allows an offline %s subscription', (s) => {
		expect(changePlanState(sub(s))).toBe('allowed');
	});

	it('allows a free plan', () => {
		expect(changePlanState(sub('active', plan({ payment_method: 'free' })))).toBe('allowed');
	});

	it('is paused for a paused subscription', () => {
		expect(changePlanState(sub('paused'))).toBe('paused');
	});

	it.each(['cancelled', 'expired'] as const)('is terminal for %s', (s) => {
		expect(changePlanState(sub(s))).toBe('terminal');
	});

	it('names an online plan first, whatever the status (the backend checks it first)', () => {
		const online = plan({ payment_method: 'online' });
		expect(changePlanState(sub('active', online))).toBe('online');
		expect(changePlanState(sub('paused', online))).toBe('online');
	});
});

describe('eligibleChangePlans', () => {
	const current = plan({ id: 'cur' });

	it('keeps same-method, same-currency, active plans, and nothing else', () => {
		const keep = plan({ id: 'keep', tier_id: 't2', tier_name: 'Silver' });
		const all = [
			current,
			keep,
			plan({ id: 'archived', is_active: false }),
			plan({ id: 'online', payment_method: 'online' }),
			plan({ id: 'free', payment_method: 'free' }),
			plan({ id: 'usd', currency: 'USD' })
		];
		expect(eligibleChangePlans(all, current).map((p) => p.id)).toEqual(['keep']);
	});

	it('drops a plan with no id', () => {
		expect(eligibleChangePlans([plan({ id: null })], current)).toEqual([]);
	});
});

describe('groupPlansByTier', () => {
	it('groups by tier, keeping the incoming order', () => {
		const groups = groupPlansByTier([
			plan({ id: 'a', tier_id: 't1', tier_name: 'Gold' }),
			plan({ id: 'b', tier_id: 't2', tier_name: 'Silver' }),
			plan({ id: 'c', tier_id: 't1', tier_name: 'Gold' })
		]);
		expect(groups.map((g) => [g.tierName, g.plans.map((p) => p.id)])).toEqual([
			['Gold', ['a', 'c']],
			['Silver', ['b']]
		]);
	});
});

describe('planChangeErrorMessage', () => {
	const cases: [string, string][] = [
		['tier_follows_subscription', "This member's tier follows their subscription plan"],
		['plan_change_online', 'Members change an online plan themselves.'],
		['subscription_terminal', 'This subscription has ended'],
		['subscription_paused', 'Resume the subscription before changing its plan.'],
		['plan_unchanged', 'The subscription is already on this plan.'],
		['plan_archived', 'This plan is archived'],
		['plan_payment_method_mismatch', 'different payment method'],
		['plan_currency_mismatch', 'different currency']
	];

	it.each(cases)('maps the 409 code %s to its own message', (code, text) => {
		expect(planChangeErrorMessage({ detail: 'x', code }, 409)).toContain(text);
	});

	it('does not read the (translated) detail when a code is present', () => {
		expect(
			planChangeErrorMessage({ detail: 'Irgendwas', code: 'plan_unchanged' }, 409)
		).not.toContain('Irgendwas');
	});

	it('maps a 400 to the sold-out message and a 404 to not-found', () => {
		expect(planChangeErrorMessage({ detail: 'This plan is sold out.' }, 400)).toBe(
			'This plan is sold out.'
		);
		expect(planChangeErrorMessage({ detail: 'Not found.' }, 404)).toContain("wasn't found");
	});

	it('falls back to the backend detail, then to a generic sentence', () => {
		expect(planChangeErrorMessage({ detail: 'Boom' }, 500)).toBe('Boom');
		expect(planChangeErrorMessage(undefined, 500)).toBe("Couldn't change the plan.");
	});
});

describe('planChangeRefusalCode', () => {
	it('returns only codes of the generated union', () => {
		expect(planChangeRefusalCode({ code: 'plan_archived' })).toBe('plan_archived');
		expect(planChangeRefusalCode({ code: 'something_new' })).toBeNull();
		expect(planChangeRefusalCode(null)).toBeNull();
	});
});

describe('isPlanSoldOut', () => {
	it('is sold out only when a cap exists and is reached', () => {
		expect(isPlanSoldOut(plan({ max_subscriptions: 2, active_subscription_count: 2 }))).toBe(true);
		expect(isPlanSoldOut(plan({ max_subscriptions: 2, active_subscription_count: 1 }))).toBe(false);
		expect(isPlanSoldOut(plan({ max_subscriptions: null, active_subscription_count: 99 }))).toBe(
			false
		);
	});
});
