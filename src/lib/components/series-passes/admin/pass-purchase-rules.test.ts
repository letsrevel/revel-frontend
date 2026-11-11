import { describe, it, expect } from 'vitest';
import { tierRuleStricterThanPass, tierStricterThanPass } from './pass-purchase-rules';

const RULES = ['public', 'members', 'invited', 'invited_and_members', 'non_members'];

// Mirrors revel-backend tests/events for `tier_rule_stricter_than_pass`:
// pass rule -> tier rules that may be linked (everything else is stricter).
const ALLOWED: Record<string, string[]> = {
	public: ['public'],
	members: ['public', 'members', 'invited_and_members'],
	invited: ['public', 'invited', 'invited_and_members'],
	invited_and_members: ['public', 'invited_and_members'],
	non_members: ['public', 'non_members']
};

describe('tierRuleStricterThanPass', () => {
	for (const pass of Object.keys(ALLOWED)) {
		for (const tier of RULES) {
			const allowed = ALLOWED[pass].includes(tier);
			it(`${tier} tier under a ${pass} pass is ${allowed ? 'compatible' : 'stricter'}`, () => {
				expect(tierRuleStricterThanPass(tier, pass, false)).toBe(!allowed);
			});
		}
	}

	it('treats a tier restricted to membership tiers as always stricter', () => {
		for (const pass of RULES) {
			expect(tierRuleStricterThanPass('members', pass, true)).toBe(true);
			expect(tierRuleStricterThanPass('public', pass, true)).toBe(true);
		}
	});

	it('fails closed on an unknown pass rule', () => {
		expect(tierRuleStricterThanPass('public', 'bogus', false)).toBe(true);
	});

	it('does not count excluded membership tiers as a stricter signal', () => {
		expect(
			tierStricterThanPass(
				{
					purchasable_by: 'non_members',
					restricted_to_membership_tiers: []
				},
				'non_members'
			)
		).toBe(false);
	});
});

describe('tierStricterThanPass', () => {
	it('defaults a missing purchasable_by to public', () => {
		expect(tierStricterThanPass({}, 'members')).toBe(false);
		expect(tierStricterThanPass({}, 'public')).toBe(false);
	});

	it('flags a restricted tier even when its rule is public', () => {
		expect(
			tierStricterThanPass(
				{ purchasable_by: 'public', restricted_to_membership_tiers: [{ id: 'x' }] },
				'members'
			)
		).toBe(true);
	});
});
