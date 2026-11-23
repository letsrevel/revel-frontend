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

	it('marks a FREE plan of the own tier as own_tier', () => {
		expect(planCtaState({ ...base, planIsFree: true, viewer: member })).toBe('own_tier');
	});

	it('keeps the CTA on a PAID plan of the own tier (own_tier_paid)', () => {
		expect(planCtaState({ ...base, viewer: member })).toBe('own_tier_paid');
	});

	it('keeps a paid plan of another tier open (tier change)', () => {
		expect(planCtaState({ ...base, planTierId: 'tier-silver', viewer: member })).toBe('default');
	});

	it('withdraws a free plan of another tier', () => {
		expect(
			planCtaState({ ...base, planTierId: 'tier-silver', planIsFree: true, viewer: member })
		).toBe('free_other_tier');
	});

	it('blocks only the owner, on every plan', () => {
		const owner = { ...NO_PLAN_VIEWER, isOwner: true };
		expect(planCtaState({ ...base, viewer: owner })).toBe('owner');
		expect(planCtaState({ ...base, planIsFree: true, viewer: owner })).toBe('owner');
		expect(planCtaState({ ...base, viewer: { ...member, isOwner: true } })).toBe('owner');
	});

	it('treats a staff-only viewer like any other non-member', () => {
		expect(planCtaState({ ...base, viewer: { ...NO_PLAN_VIEWER } })).toBe('default');
	});

	it('lets a live subscription drive the card instead', () => {
		expect(planCtaState({ ...base, hasSubscription: true, viewer: member })).toBe('default');
	});

	it('reports a paused or banned member, with no live subscription', () => {
		expect(planCtaState({ ...base, viewer: { ...member, membershipStatus: 'paused' } })).toBe(
			'paused'
		);
		expect(planCtaState({ ...base, viewer: { ...member, membershipStatus: 'banned' } })).toBe(
			'banned'
		);
	});

	it('does not treat a cancelled or awaiting-payment membership as an active one', () => {
		for (const status of ['cancelled', 'awaiting_payment'] as const) {
			expect(planCtaState({ ...base, viewer: { ...member, membershipStatus: status } })).toBe(
				'default'
			);
		}
	});

	it('stays neutral while the subscription lookup is loading', () => {
		expect(planCtaState({ ...base, subscriptionLoading: true, viewer: member })).toBe('default');
		expect(
			planCtaState({
				...base,
				subscriptionLoading: true,
				viewer: { ...member, membershipStatus: 'paused' }
			})
		).toBe('default');
		// The owner is known without it.
		expect(
			planCtaState({
				...base,
				subscriptionLoading: true,
				viewer: { ...NO_PLAN_VIEWER, isOwner: true }
			})
		).toBe('owner');
	});

	it('does not match a member without a known tier', () => {
		expect(planCtaState({ ...base, viewer: { ...member, membershipTierId: null } })).toBe(
			'default'
		);
	});
});
