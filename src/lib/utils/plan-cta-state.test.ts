import { describe, it, expect } from 'vitest';
import { NO_PLAN_VIEWER, planCtaState, type PlanViewer } from './plan-cta-state';

const member: PlanViewer = {
	...NO_PLAN_VIEWER,
	isMember: true,
	membershipStatus: 'active',
	membershipTierId: 'tier-gold'
};

const base = { planTierId: 'tier-gold', planIsFree: false, hasSubscription: false };

describe('planCtaState', () => {
	it('leaves a guest and a non-member on the default flow', () => {
		expect(planCtaState({ ...base, viewer: NO_PLAN_VIEWER })).toBe('default');
	});

	it('marks an active member own tier as own_tier, free or paid', () => {
		expect(planCtaState({ ...base, viewer: member })).toBe('own_tier');
		expect(planCtaState({ ...base, planIsFree: true, viewer: member })).toBe('own_tier');
	});

	it('keeps a paid plan of another tier open (tier change)', () => {
		expect(planCtaState({ ...base, planTierId: 'tier-silver', viewer: member })).toBe('default');
	});

	it('withdraws a free plan of another tier', () => {
		expect(
			planCtaState({ ...base, planTierId: 'tier-silver', planIsFree: true, viewer: member })
		).toBe('free_other_tier');
	});

	it('hides join for the owner and for staff on every plan', () => {
		const owner = { ...NO_PLAN_VIEWER, isOwner: true };
		const staff = { ...NO_PLAN_VIEWER, isStaff: true };
		expect(planCtaState({ ...base, viewer: owner })).toBe('staff');
		expect(planCtaState({ ...base, planIsFree: true, viewer: staff })).toBe('staff');
		expect(planCtaState({ ...base, viewer: { ...member, isOwner: true } })).toBe('staff');
	});

	it('lets a live subscription drive the card instead', () => {
		expect(planCtaState({ ...base, hasSubscription: true, viewer: member })).toBe('default');
	});

	it('does not treat a non-active membership as an active one', () => {
		for (const status of ['paused', 'cancelled', 'banned', 'awaiting_payment'] as const) {
			expect(planCtaState({ ...base, viewer: { ...member, membershipStatus: status } })).toBe(
				'default'
			);
		}
	});

	it('does not match a member without a known tier', () => {
		expect(planCtaState({ ...base, viewer: { ...member, membershipTierId: null } })).toBe(
			'default'
		);
	});
});
