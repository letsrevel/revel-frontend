import { describe, it, expect } from 'vitest';
import { getAccountNavItems } from './account-nav';

const hrefs = (o: Parameters<typeof getAccountNavItems>[0]): string[] =>
	getAccountNavItems(o).map((i) => i.href);

describe('getAccountNavItems', () => {
	it('returns the six always-visible pages in order', () => {
		expect(hrefs({ oauthEnabled: false, isTenant: false })).toEqual([
			'/account/profile',
			'/account/security',
			'/account/privacy',
			'/account/settings',
			'/account/invoices',
			'/account/memberships'
		]);
	});

	it('adds the OAuth pages only when the provider flag is on', () => {
		const list = hrefs({ oauthEnabled: true, isTenant: false });
		expect(list.slice(6)).toEqual(['/account/connected-apps', '/account/developer-apps']);
	});

	it('adds referral pages (group referral) for a referrer off a tenant host', () => {
		const items = getAccountNavItems({ oauthEnabled: false, isTenant: false, referralCode: 'abc' });
		expect(items.slice(6).map((i) => [i.href, i.group])).toEqual([
			['/account/referral', 'referral'],
			['/account/referral/payouts', 'referral']
		]);
		expect(items.slice(0, 6).every((i) => i.group === 'account')).toBe(true);
	});

	it('hides referral pages on a tenant host or without a code', () => {
		expect(hrefs({ oauthEnabled: false, isTenant: true, referralCode: 'abc' })).toHaveLength(6);
		expect(hrefs({ oauthEnabled: false, isTenant: false, referralCode: null })).toHaveLength(6);
	});

	it('gives every item a label and an icon', () => {
		for (const i of getAccountNavItems({
			oauthEnabled: true,
			isTenant: false,
			referralCode: 'x'
		})) {
			expect(i.label).toBeTruthy();
			expect(i.icon).toBeTruthy();
		}
	});
});
