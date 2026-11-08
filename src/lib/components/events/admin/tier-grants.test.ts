import { describe, it, expect } from 'vitest';
import {
	audienceBlocksGrant,
	grantConflicts,
	grantsError,
	grantsPayload,
	hasGrant,
	isGrantsField
} from './tier-grants';

describe('audienceBlocksGrant', () => {
	it.each(['members', 'invited_and_members'])('blocks %s', (v) => {
		expect(audienceBlocksGrant(v)).toBe(true);
	});
	it.each(['public', 'invited', 'non_members'])('allows %s', (v) => {
		expect(audienceBlocksGrant(v)).toBe(false);
	});
});

describe('hasGrant', () => {
	it('is true only for a non-empty id', () => {
		expect(hasGrant('abc')).toBe(true);
		expect(hasGrant('')).toBe(false);
		expect(hasGrant(null)).toBe(false);
		expect(hasGrant(undefined)).toBe(false);
	});
});

describe('grantsPayload', () => {
	it('sends the id on create and update', () => {
		expect(grantsPayload('t1', false)).toEqual({ grants_membership_tier_id: 't1' });
		expect(grantsPayload('t1', true)).toEqual({ grants_membership_tier_id: 't1' });
	});
	it('omits on create when empty', () => {
		expect(grantsPayload('', false)).toEqual({});
	});
	it('sends null on update when cleared so the stored grant is removed', () => {
		expect(grantsPayload('', true)).toEqual({ grants_membership_tier_id: null });
	});
});

describe('grantConflicts', () => {
	it('reports nothing without a grant', () => {
		expect(grantConflicts('', 'members', '5')).toEqual({ audience: false, maxTickets: false });
	});
	it('flags a members-only audience', () => {
		expect(grantConflicts('t1', 'members', '1').audience).toBe(true);
		expect(grantConflicts('t1', 'invited_and_members', '1').audience).toBe(true);
	});
	it('flags a max other than exactly 1, including empty', () => {
		expect(grantConflicts('t1', 'public', '2').maxTickets).toBe(true);
		expect(grantConflicts('t1', 'public', '').maxTickets).toBe(true);
		expect(grantConflicts('t1', 'public', '1')).toEqual({ audience: false, maxTickets: false });
	});
});

describe('grants field errors', () => {
	it('recognises the model field and the attname', () => {
		expect(isGrantsField('grants_membership_tier')).toBe(true);
		expect(isGrantsField('grants_membership_tier_id')).toBe(true);
		expect(isGrantsField('purchasable_by')).toBe(false);
	});
	it('joins only the grant messages', () => {
		expect(
			grantsError({
				errors: {
					grants_membership_tier: ['Only a temporary tier can be granted by tickets.'],
					max_tickets_per_user: ['other']
				}
			})
		).toBe('Only a temporary tier can be granted by tickets.');
		expect(grantsError(null)).toBe('');
		expect(grantsError({ detail: 'nope' })).toBe('');
	});
});
