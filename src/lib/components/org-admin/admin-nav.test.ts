import { describe, it, expect } from 'vitest';
import { buildAdminNav, allNavItems, isNavItemActive, activeNavHref } from './admin-nav';

const base = {
	orgSlug: 'acme',
	isOwner: false,
	canVerifyMembers: false,
	customDomainEnabled: false,
	billingWarning: false
};
const ids = (o: Partial<typeof base>) =>
	allNavItems(buildAdminNav({ ...base, ...o })).map((i) => i.id);

describe('buildAdminNav', () => {
	it('hides owner-only items from staff', () => {
		const result = ids({});
		for (const id of ['billing', 'financials', 'integrations', 'custom-domain']) {
			expect(result).not.toContain(id);
		}
		expect(result).toContain('events');
	});

	it('shows owner items, and custom domain only when enabled', () => {
		expect(ids({ isOwner: true })).toEqual(expect.arrayContaining(['billing', 'financials']));
		expect(ids({ isOwner: true })).not.toContain('custom-domain');
		expect(ids({ isOwner: true, customDomainEnabled: true })).toContain('custom-domain');
		expect(ids({ isOwner: false, customDomainEnabled: true })).not.toContain('custom-domain');
	});

	it('shows verify members only when allowed', () => {
		expect(ids({})).not.toContain('verify-members');
		expect(ids({ canVerifyMembers: true })).toContain('verify-members');
	});

	it('flags billing with a warning badge only when needed', () => {
		const find = (w: boolean) =>
			allNavItems(buildAdminNav({ ...base, isOwner: true, billingWarning: w })).find(
				(i) => i.id === 'billing'
			);
		expect(find(true)?.badge).toBe('warning');
		expect(find(false)?.badge).toBeUndefined();
	});

	it('groups items in the expected order', () => {
		const nav = buildAdminNav({ ...base, isOwner: true });
		expect(nav.groups.map((g) => g.id)).toEqual(['events', 'people', 'content', 'organization']);
		expect(nav.dashboard.href).toBe('/org/acme/admin');
	});
});

describe('isNavItemActive', () => {
	it('matches the dashboard exactly', () => {
		expect(isNavItemActive('/org/a/admin', '/org/a/admin')).toBe(true);
		expect(isNavItemActive('/org/a/admin', '/org/a/admin/events')).toBe(false);
	});
	it('matches exact and nested paths, not look-alike prefixes', () => {
		expect(isNavItemActive('/org/a/admin/events', '/org/a/admin/events')).toBe(true);
		expect(isNavItemActive('/org/a/admin/events', '/org/a/admin/events/x/edit')).toBe(true);
		expect(isNavItemActive('/org/a/admin/events', '/org/a/admin/event-series')).toBe(false);
	});
});

describe('activeNavHref', () => {
	it('prefers the most specific item', () => {
		const nav = buildAdminNav({ ...base, canVerifyMembers: true });
		expect(activeNavHref(nav, '/org/acme/admin/members/verify')).toBe(
			'/org/acme/admin/members/verify'
		);
		expect(activeNavHref(nav, '/org/acme/admin/members')).toBe('/org/acme/admin/members');
		expect(activeNavHref(nav, '/org/acme/admin')).toBe('/org/acme/admin');
		expect(activeNavHref(nav, '/elsewhere')).toBeNull();
	});
});
