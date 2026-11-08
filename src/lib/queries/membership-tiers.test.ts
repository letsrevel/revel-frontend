import { describe, it, expect, vi, beforeEach } from 'vitest';

const listMock = vi.hoisted(() => vi.fn());
vi.mock('$lib/api', () => ({ organizationadminmembersListMembershipTiers: listMock }));

import { membershipTiersKeys, listStandardTiers } from './membership-tiers';

describe('membershipTiersKeys', () => {
	it('standard key is prefixed by the all key', () => {
		const all = membershipTiersKeys.all('org');
		const standard = membershipTiersKeys.standard('org');
		expect(standard.slice(0, all.length)).toEqual([...all]);
		expect(standard.length).toBeGreaterThan(all.length);
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
