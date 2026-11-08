import { describe, it, expect, vi, beforeEach } from 'vitest';

const listMock = vi.hoisted(() => vi.fn());
vi.mock('$lib/api', () => ({ organizationadminmembersListMembershipTiers: listMock }));

import {
	membershipTiersKeys,
	listStandardTiers,
	listTiersOfKind,
	tiersOfKindQueryOptions
} from './membership-tiers';

describe('membershipTiersKeys', () => {
	it('standard key is prefixed by the all key', () => {
		const all = membershipTiersKeys.all('org');
		const standard = membershipTiersKeys.standard('org');
		expect(standard.slice(0, all.length)).toEqual([...all]);
		expect(standard.length).toBeGreaterThan(all.length);
	});

	it('temporary key is prefixed by all and distinct from standard', () => {
		const all = membershipTiersKeys.all('org');
		const temporary = membershipTiersKeys.temporary('org');
		expect(temporary.slice(0, all.length)).toEqual([...all]);
		expect(temporary).not.toEqual(membershipTiersKeys.standard('org'));
	});

	it('keys are scoped per slug', () => {
		expect(membershipTiersKeys.all('a')).not.toEqual(membershipTiersKeys.all('b'));
	});
});

describe('listStandardTiers', () => {
	beforeEach(() => listMock.mockReset());

	it('requests kind=standard and filters out temporary tiers', async () => {
		listMock.mockResolvedValue({
			data: [
				{ id: 'a', kind: 'standard' },
				{ id: 'b', kind: 'temporary' }
			],
			error: undefined
		});
		const tiers = await listStandardTiers('org', 'tok');
		expect(tiers.map((t) => t.id)).toEqual(['a']);
		expect(listMock).toHaveBeenCalledWith(
			expect.objectContaining({
				path: { slug: 'org' },
				query: { kind: 'standard' },
				headers: { Authorization: 'Bearer tok' }
			})
		);
	});

	it('throws the API error', async () => {
		const err = { detail: 'nope' };
		listMock.mockResolvedValue({ data: undefined, error: err });
		await expect(listStandardTiers('org', 'tok')).rejects.toBe(err);
	});
});

describe('listTiersOfKind', () => {
	beforeEach(() => listMock.mockReset());

	it('requests kind=temporary and filters out standard tiers', async () => {
		listMock.mockResolvedValue({
			data: [
				{ id: 'a', kind: 'standard' },
				{ id: 'b', kind: 'temporary' }
			],
			error: undefined
		});
		const tiers = await listTiersOfKind('org', 'temporary', 'tok');
		expect(tiers.map((t) => t.id)).toEqual(['b']);
		expect(listMock).toHaveBeenCalledWith(
			expect.objectContaining({ path: { slug: 'org' }, query: { kind: 'temporary' } })
		);
	});

	it('throws the API error', async () => {
		const err = { detail: 'nope' };
		listMock.mockResolvedValue({ data: undefined, error: err });
		await expect(listTiersOfKind('org', 'temporary', 'tok')).rejects.toBe(err);
	});

	it('refuses to call the API without an access token', async () => {
		await expect(listTiersOfKind('org', 'standard', undefined)).rejects.toThrow(
			/missing access token/
		);
		expect(listMock).not.toHaveBeenCalled();
	});

	it('keys the query by kind', () => {
		expect(tiersOfKindQueryOptions('org', 'temporary', 'tok').queryKey).toEqual(
			membershipTiersKeys.temporary('org')
		);
		expect(tiersOfKindQueryOptions('org', 'standard', 'tok').queryKey).toEqual(
			membershipTiersKeys.standard('org')
		);
	});
});
