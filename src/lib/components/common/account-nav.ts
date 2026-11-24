import type { Component } from 'svelte';
import {
	User,
	Shield,
	Lock,
	Settings,
	Receipt,
	CreditCard,
	Plug,
	CodeXml,
	Gift,
	FileText
} from '@lucide/svelte';
import { resolve } from '$app/paths';
import * as m from '$lib/paraglide/messages.js';

export interface AccountNavItem {
	href: string;
	label: string;
	icon: Component;
	/** `referral` items are only offered to referrers off a tenant host. */
	group: 'account' | 'referral';
}

export interface AccountNavOptions {
	/** `features.oauth_provider`: gates Connected apps and Developer apps (fail-closed). */
	oauthEnabled: boolean;
	/** On an organization's custom domain the referral program lives on the platform. */
	isTenant: boolean;
	/** The user's referral code (any truthy value); its presence makes them a referrer. */
	referralCode?: unknown;
}

/**
 * The single list of account pages, shared by the account area's side nav and
 * the user menu. Order and visibility rules live here only.
 */
export function getAccountNavItems({
	oauthEnabled,
	isTenant,
	referralCode
}: AccountNavOptions): AccountNavItem[] {
	const account = (href: string, label: string, icon: Component): AccountNavItem => ({
		href,
		label,
		icon,
		group: 'account'
	});
	const referral = (href: string, label: string, icon: Component): AccountNavItem => ({
		href,
		label,
		icon,
		group: 'referral'
	});
	return [
		account(resolve('/(auth)/account/profile', {}), m['userMenu.profile'](), User),
		account(resolve('/(auth)/account/security', {}), m['userMenu.security'](), Shield),
		account(resolve('/(auth)/account/privacy', {}), m['userMenu.privacy'](), Lock),
		account(resolve('/(auth)/account/settings', {}), m['userMenu.settings'](), Settings),
		account(resolve('/(auth)/account/invoices', {}), m['userMenu.invoices'](), Receipt),
		account(resolve('/(auth)/account/memberships', {}), m['userMenu.memberships'](), CreditCard),
		...(oauthEnabled
			? [
					account(
						resolve('/(auth)/account/connected-apps', {}),
						m['userMenu.connectedApps'](),
						Plug
					),
					account(
						resolve('/(auth)/account/developer-apps', {}),
						m['userMenu.developerApps'](),
						CodeXml
					)
				]
			: []),
		...(!isTenant && referralCode
			? [
					referral(resolve('/(auth)/account/referral', {}), m['referral.settings'](), Gift),
					referral(
						resolve('/(auth)/account/referral/payouts', {}),
						m['referral.payouts'](),
						FileText
					)
				]
			: [])
	];
}
