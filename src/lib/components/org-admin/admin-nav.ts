import * as m from '$lib/paraglide/messages.js';
import { resolve } from '$app/paths';
import type { ResolvedPathname } from '$app/types';
import type { Component } from 'svelte';
import {
	Ban,
	BarChart3,
	Calendar,
	ClipboardList,
	Code,
	CreditCard,
	FolderOpen,
	Globe,
	LayoutDashboard,
	MapPin,
	Megaphone,
	Plug,
	Repeat,
	ScanLine,
	Settings,
	Tag,
	Ticket,
	Users,
	Wallet
} from '@lucide/svelte';

export interface NavItem {
	id: string;
	label: string;
	href: ResolvedPathname;
	icon: Component;
	badge?: 'warning';
}

export interface NavGroup {
	id: string;
	label: string;
	items: NavItem[];
}

export interface AdminNav {
	dashboard: NavItem;
	groups: NavGroup[];
}

export interface AdminNavOptions {
	orgSlug: string;
	isOwner: boolean;
	canVerifyMembers: boolean;
	customDomainEnabled: boolean;
	billingWarning: boolean;
}

/**
 * Single source of truth for the org admin navigation (desktop sidebar, mobile
 * drawer and layout breadcrumbs).
 */
export function buildAdminNav(opts: AdminNavOptions): AdminNav {
	const slug = opts.orgSlug;
	const { isOwner, canVerifyMembers, customDomainEnabled, billingWarning } = opts;

	const dashboard: NavItem = {
		id: 'dashboard',
		label: m['orgAdmin.nav.dashboard'](),
		href: resolve('/(auth)/org/[slug]/admin', { slug }),
		icon: LayoutDashboard
	};

	const groups: NavGroup[] = [
		{
			id: 'events',
			label: m['orgAdmin.dashboard.tools.groups.events'](),
			items: [
				{
					id: 'events',
					label: m['orgAdmin.nav.events'](),
					icon: Calendar,
					href: resolve('/(auth)/org/[slug]/admin/events', { slug })
				},
				{
					id: 'event-series',
					label: m['orgAdmin.nav.eventSeries'](),
					icon: Repeat,
					href: resolve('/(auth)/org/[slug]/admin/event-series', { slug })
				},
				{
					id: 'tickets',
					label: m['orgAdmin.nav.tickets'](),
					icon: Ticket,
					href: resolve('/(auth)/org/[slug]/admin/tickets', { slug })
				},
				{
					id: 'discount-codes',
					label: m['orgAdmin.nav.discountCodes'](),
					icon: Tag,
					href: resolve('/(auth)/org/[slug]/admin/discount-codes', { slug })
				}
			]
		},
		{
			id: 'people',
			label: m['orgAdmin.dashboard.tools.groups.people'](),
			items: [
				{
					id: 'members',
					label: m['orgAdmin.nav.members'](),
					icon: Users,
					href: resolve('/(auth)/org/[slug]/admin/members', { slug })
				},
				// Gated on `check_in_attendees`, the same permission the backend's verify
				// endpoint requires. This is the ONLY entry point for a door steward who
				// holds nothing else: the Members page itself 403s them.
				...(canVerifyMembers
					? [
							{
								id: 'verify-members',
								label: m['orgAdmin.dashboard.quickActions.verifyMembers.title'](),
								icon: ScanLine,
								href: resolve('/(auth)/org/[slug]/admin/members/verify', { slug })
							}
						]
					: []),
				{
					id: 'blacklist',
					label: m['orgAdmin.dashboard.quickActions.blacklist.title'](),
					icon: Ban,
					href: resolve('/(auth)/org/[slug]/admin/blacklist', { slug })
				},
				{
					id: 'announcements',
					label: m['orgAdmin.nav.announcements'](),
					icon: Megaphone,
					href: resolve('/(auth)/org/[slug]/admin/announcements', { slug })
				}
			]
		},
		{
			id: 'content',
			label: m['orgAdmin.dashboard.tools.groups.content'](),
			items: [
				{
					id: 'polls',
					label: m['orgAdmin.nav.polls'](),
					icon: BarChart3,
					href: resolve('/(auth)/org/[slug]/admin/polls', { slug })
				},
				{
					id: 'questionnaires',
					label: m['orgAdmin.nav.questionnaires'](),
					icon: ClipboardList,
					href: resolve('/(auth)/org/[slug]/admin/questionnaires', { slug })
				},
				{
					id: 'resources',
					label: m['orgAdmin.nav.resources'](),
					icon: FolderOpen,
					href: resolve('/(auth)/org/[slug]/admin/resources', { slug })
				}
			]
		},
		{
			id: 'organization',
			label: m['orgAdmin.dashboard.tools.groups.organization'](),
			items: [
				{
					id: 'venues',
					label: m['orgAdmin.nav.venues'](),
					icon: MapPin,
					href: resolve('/(auth)/org/[slug]/admin/venues', { slug })
				},
				{
					id: 'embed',
					label: m['orgAdmin.nav.embed'](),
					icon: Code,
					href: resolve('/(auth)/org/[slug]/admin/embed', { slug })
				},
				{
					id: 'settings',
					label: m['orgAdmin.nav.settings'](),
					icon: Settings,
					href: resolve('/(auth)/org/[slug]/admin/settings', { slug })
				},
				...(isOwner
					? [
							{
								id: 'billing',
								label: m['orgAdmin.nav.billing'](),
								icon: CreditCard,
								href: resolve('/(auth)/org/[slug]/admin/billing', { slug }),
								...(billingWarning ? { badge: 'warning' as const } : {})
							},
							{
								id: 'financials',
								label: m['orgAdmin.nav.financials'](),
								icon: Wallet,
								href: resolve('/(auth)/org/[slug]/admin/financials', { slug })
							},
							{
								id: 'integrations',
								label: m['orgAdmin.nav.integrations'](),
								icon: Plug,
								href: resolve('/(auth)/org/[slug]/admin/integrations', { slug })
							},
							// Platform-superuser switch; owner-only on the backend as well.
							...(customDomainEnabled
								? [
										{
											id: 'custom-domain',
											label: m['orgAdmin.nav.customDomain'](),
											icon: Globe,
											href: resolve('/(auth)/org/[slug]/admin/custom-domain', { slug })
										}
									]
								: [])
						]
					: [])
			]
		}
	];

	return { dashboard, groups };
}

/** All items flattened, dashboard first. */
export function allNavItems(nav: AdminNav): NavItem[] {
	return [nav.dashboard, ...nav.groups.flatMap((g) => g.items)];
}

/** Dashboard (admin root) matches exactly; every other item matches itself or a sub-path. */
export function isNavItemActive(href: string, pathname: string): boolean {
	if (href.endsWith('/admin')) {
		return pathname === href;
	}
	return pathname === href || pathname.startsWith(href + '/');
}

/**
 * The single most specific active item's href (longest match), so that
 * "Members" does not light up alongside "Verify members" (a sub-path of it).
 */
export function activeNavHref(nav: AdminNav, pathname: string): string | null {
	let best: string | null = null;
	for (const item of allNavItems(nav)) {
		if (isNavItemActive(item.href, pathname) && (best === null || item.href.length > best.length)) {
			best = item.href;
		}
	}
	return best;
}
