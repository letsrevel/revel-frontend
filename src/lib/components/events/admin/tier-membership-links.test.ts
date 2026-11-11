import { describe, it, expect } from 'vitest';
import {
	restrictedTiersPayload,
	membershipLinksPayload,
	excludedTiersPayload,
	excludedTiersError,
	linkedTierIds
} from './tier-membership-links';

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

describe('excludedTiersPayload', () => {
	it('replaces with a non-empty selection on non_members, on create and update', () => {
		expect(excludedTiersPayload('non_members', ['a', 'b'], true)).toEqual(['a', 'b']);
		expect(excludedTiersPayload('non_members', ['a'], false)).toEqual(['a']);
	});

	it('sends [] on update when nothing is selected (clears: exclude every active member)', () => {
		expect(excludedTiersPayload('non_members', [], true)).toEqual([]);
	});

	it('sends [] on update off non_members, even with a stale selection', () => {
		expect(excludedTiersPayload('public', ['a'], true)).toEqual([]);
		expect(excludedTiersPayload('members', ['a'], true)).toEqual([]);
	});

	it('sends null on create when nothing applies', () => {
		expect(excludedTiersPayload('non_members', [], false)).toBeNull();
		expect(excludedTiersPayload('public', ['a'], false)).toBeNull();
	});
});

describe('membershipLinksPayload', () => {
	it('carries both link lists with the three-way contract', () => {
		expect(membershipLinksPayload('members', ['a'], true)).toEqual({
			restricted_to_membership_tiers_ids: ['a'],
			excluded_membership_tiers_ids: []
		});
		expect(membershipLinksPayload('non_members', ['x'], true, ['e'])).toEqual({
			restricted_to_membership_tiers_ids: [],
			excluded_membership_tiers_ids: ['e']
		});
		expect(membershipLinksPayload('non_members', [], true)).toEqual({
			restricted_to_membership_tiers_ids: [],
			excluded_membership_tiers_ids: []
		});
		expect(membershipLinksPayload('members', [], false)).toEqual({
			restricted_to_membership_tiers_ids: null,
			excluded_membership_tiers_ids: null
		});
	});
});

describe('linkedTierIds', () => {
	it('maps ids and tolerates null / id-less rows', () => {
		expect(linkedTierIds(null)).toEqual([]);
		expect(linkedTierIds([{ id: 'a' }, { id: null }, {}])).toEqual(['a']);
	});
});

describe('excludedTiersError', () => {
	it('picks only the exclusion field messages', () => {
		expect(
			excludedTiersError([
				{ field: 'name', messages: ['bad'] },
				{ field: 'excluded_membership_tiers_ids', messages: ['Only for non-members tiers.'] }
			])
		).toBe('Only for non-members tiers.');
		expect(excludedTiersError([])).toBe('');
	});
});
