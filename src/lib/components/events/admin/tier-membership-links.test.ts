import { describe, it, expect } from 'vitest';
import { restrictedTiersPayload, membershipLinksPayload } from './tier-membership-links';

describe('restrictedTiersPayload', () => {
	it('replaces with a non-empty selection under members audiences', () => {
		expect(restrictedTiersPayload('members', ['a'], true)).toEqual(['a']);
		expect(restrictedTiersPayload('invited_and_members', ['a', 'b'], false)).toEqual(['a', 'b']);
	});

	it('sends [] on update when the selection is empty (clears, never keeps)', () => {
		expect(restrictedTiersPayload('members', [], true)).toEqual([]);
	});

	it('sends [] on update when the audience no longer allows restrictions', () => {
		expect(restrictedTiersPayload('non_members', ['a'], true)).toEqual([]);
		expect(restrictedTiersPayload('public', ['a'], true)).toEqual([]);
	});

	it('sends null on create when nothing is selected', () => {
		expect(restrictedTiersPayload('members', [], false)).toBeNull();
		expect(restrictedTiersPayload('non_members', ['a'], false)).toBeNull();
	});
});

describe('membershipLinksPayload', () => {
	it('clears exclusions off non_members on update only', () => {
		expect(membershipLinksPayload('members', ['a'], true)).toEqual({
			restricted_to_membership_tiers_ids: ['a'],
			excluded_membership_tiers_ids: []
		});
		expect(membershipLinksPayload('non_members', [], true)).toEqual({
			restricted_to_membership_tiers_ids: []
		});
		expect(membershipLinksPayload('members', [], false)).toEqual({
			restricted_to_membership_tiers_ids: null
		});
	});
});
