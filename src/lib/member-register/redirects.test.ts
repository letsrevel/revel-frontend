import { describe, expect, it } from 'vitest';
import {
	LEGACY_TAB_MAP,
	MEMBERS_TABS,
	isMembersTab,
	legacyTabRedirect,
	registerRedirectTarget
} from './redirects';

const params = (qs: string) => new URLSearchParams(qs);

describe('registerRedirectTarget', () => {
	it('sends the retired register page to the People tab', () => {
		const target = registerRedirectTarget('acme', params('kind=standard&status=open'));
		const url = new URL(target, 'https://x.test');
		expect(url.pathname).toBe('/org/acme/admin/members');
		expect(url.searchParams.get('tab')).toBe('people');
		expect(url.searchParams.get('kind')).toBe('standard');
		expect(url.searchParams.get('status')).toBe('open');
		expect(url.searchParams.has('view')).toBe(false);
	});

	it('preserves the whole filter query', () => {
		const target = registerRedirectTarget(
			'acme',
			params('account=without&tier=abc&q=ada&on=2026-03-12&page=2')
		);
		const sp = new URL(target, 'https://x.test').searchParams;
		expect(Object.fromEntries(sp)).toEqual({
			account: 'without',
			tier: 'abc',
			q: 'ada',
			on: '2026-03-12',
			page: '2',
			tab: 'people'
		});
	});

	it('lands an unfiltered register link on Everyone, since it used to list every entry', () => {
		const sp = new URL(registerRedirectTarget('acme', params('')), 'https://x.test').searchParams;
		expect(sp.get('view')).toBe('everyone');
		expect(sp.get('tab')).toBe('people');
		const search = new URL(registerRedirectTarget('acme', params('q=ada')), 'https://x.test')
			.searchParams;
		expect(search.get('view')).toBe('everyone');
		expect(search.get('q')).toBe('ada');
	});

	it('does not add a view when the old link already narrowed the list', () => {
		for (const qs of ['kind=temporary', 'status=closed', 'account=with', 'view=ended']) {
			const sp = new URL(registerRedirectTarget('acme', params(qs)), 'https://x.test').searchParams;
			expect(sp.get('view') === 'everyone').toBe(false);
		}
	});
});

describe('legacyTabRedirect', () => {
	it('maps the renamed tabs and keeps the other params', () => {
		expect(legacyTabRedirect(params('tab=members'))).toBe('tab=people');
		expect(legacyTabRedirect(params('tab=requests'))).toBe('tab=applications');
		expect(legacyTabRedirect(params('tab=tokens&x=1'))).toBe('tab=invite-links&x=1');
	});

	it('leaves canonical, unknown and missing tabs alone', () => {
		for (const qs of ['', 'tab=people', 'tab=tiers', 'tab=payments', 'tab=nope', 'tab=toString']) {
			expect(legacyTabRedirect(params(qs))).toBeNull();
		}
	});

	it('only ever points at a tab that exists', () => {
		for (const target of Object.values(LEGACY_TAB_MAP)) expect(isMembersTab(target)).toBe(true);
		expect(MEMBERS_TABS).toEqual([
			'people',
			'applications',
			'tiers',
			'subscriptions',
			'payments',
			'staff',
			'invite-links'
		]);
	});
});
