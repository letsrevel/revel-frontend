import { describe, it, expect } from 'vitest';
import type { AuthorizeScopeSchema } from '$lib/api/generated/types.gen';
import { GROUP_ORDER, groupHeading, groupScopes, involvesMoney, rowsFor } from './oauth-scopes';

const VOCAB: AuthorizeScopeSchema[] = [
	{ name: 'openid', label: 'Sign you in', group: 'identity' },
	{ name: 'profile', label: 'See your name and picture', group: 'identity' },
	{ name: 'me:read', label: 'See your profile', group: 'me' },
	{ name: 'org:read', label: 'See your organizations', group: 'org' },
	{ name: 'org:tickets', label: 'Manage tickets and refunds', group: 'org' },
	{ name: 'org:members', label: 'Manage members', group: 'org' }
];

describe('involvesMoney', () => {
	it('marks only org:tickets and org:members', () => {
		expect(involvesMoney('org:tickets')).toBe(true);
		expect(involvesMoney('org:members')).toBe(true);
		expect(involvesMoney('me:read')).toBe(false);
		expect(involvesMoney('org:read')).toBe(false);
	});
});

describe('groupHeading', () => {
	it('gives every group a distinct non-empty heading', () => {
		const headings = GROUP_ORDER.map(groupHeading);
		for (const h of headings) expect(h).toBeTruthy();
		expect(new Set(headings).size).toBe(3);
	});
});

describe('rowsFor', () => {
	it('orders alphabetical wire names by vocabulary position', () => {
		const rows = rowsFor(['org:tickets', 'me:read', 'openid'], VOCAB);
		expect(rows.map((r) => r.name)).toEqual(['openid', 'me:read', 'org:tickets']);
		expect(rows[0].label).toBe('Sign you in');
	});

	it('keeps an unknown scope as its own label, in the org group, last', () => {
		const rows = rowsFor(['org:new_thing', 'openid'], VOCAB);
		expect(rows.map((r) => r.name)).toEqual(['openid', 'org:new_thing']);
		expect(rows[1]).toEqual({ name: 'org:new_thing', label: 'org:new_thing', group: 'org' });
	});

	it('returns an empty array for no names', () => {
		expect(rowsFor([], VOCAB)).toEqual([]);
	});
});

describe('groupScopes', () => {
	it('groups in identity → me → org order, keeping input order inside a group, omitting empty groups', () => {
		const groups = groupScopes([VOCAB[4], VOCAB[1], VOCAB[0], VOCAB[3]]);
		expect(groups.map((g) => g.group)).toEqual(['identity', 'org']);
		expect(groups[0].rows.map((r) => r.name)).toEqual(['profile', 'openid']);
		expect(groups[1].rows.map((r) => r.name)).toEqual(['org:tickets', 'org:read']);
	});

	it('returns no groups for no rows', () => {
		expect(groupScopes([])).toEqual([]);
	});
});
