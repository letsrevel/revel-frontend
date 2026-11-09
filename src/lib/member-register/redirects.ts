/** Tabs of the unified Members area, in display order. */
export const MEMBERS_TABS = [
	'people',
	'applications',
	'tiers',
	'subscriptions',
	'payments',
	'staff',
	'invite-links'
] as const;
export type MembersTab = (typeof MEMBERS_TABS)[number];

/** Tab names used before the Members area was unified. */
export const LEGACY_TAB_MAP: Readonly<Record<string, MembersTab>> = {
	members: 'people',
	requests: 'applications',
	tokens: 'invite-links',
	// The temporary "Manage access" bridge; the person sheet replaced it.
	access: 'people'
};

export function isMembersTab(value: string | null | undefined): value is MembersTab {
	return !!value && (MEMBERS_TABS as readonly string[]).includes(value);
}

/**
 * The query to redirect an old `?tab=` value to, or null when the URL is
 * already canonical. Every other param is kept.
 */
export function legacyTabRedirect(params: URLSearchParams): string | null {
	const tab = params.get('tab');
	const next = tab && Object.hasOwn(LEGACY_TAB_MAP, tab) ? LEGACY_TAB_MAP[tab] : undefined;
	if (!next) return null;
	const out = new URLSearchParams(params);
	out.set('tab', next);
	return out.toString();
}

/**
 * Target of the retired `/admin/members/register?...` page. The filter query is
 * preserved; an old URL with no group filter meant "every entry", so it lands
 * on the Everyone chip rather than the new "Current" default.
 */
export function registerRedirectTarget(slug: string, params: URLSearchParams): string {
	const out = new URLSearchParams(params);
	out.set('tab', 'people');
	const hasGroup = ['kind', 'status', 'account', 'view'].some((key) => out.has(key));
	if (!hasGroup) out.set('view', 'everyone');
	return `/org/${slug}/admin/members?${out.toString()}`;
}
