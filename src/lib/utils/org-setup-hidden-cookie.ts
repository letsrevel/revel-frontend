/**
 * UI cookie remembering that an owner collapsed the dashboard setup card.
 * Cookie (not localStorage) so the server load can skip the setup queries and
 * SSR renders the collapsed line directly, without a flash.
 * Mirrors the `revel_admin_sidebar` pattern: plain client-set UI cookie, read server-side.
 */
const ONE_YEAR_SECONDS = 31536000;

export function setupHiddenCookieName(orgId: string): string {
	return `revel_setup_hidden_${orgId}`;
}

/** Set (hidden = true) or clear (hidden = false) the cookie. Browser only. */
export function writeSetupHiddenCookie(orgId: string, hidden: boolean): void {
	try {
		const secure = window.location.protocol === 'https:' ? '; secure' : '';
		const name = setupHiddenCookieName(orgId);
		document.cookie = hidden
			? `${name}=1; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax${secure}`
			: `${name}=; path=/; max-age=0; samesite=lax${secure}`;
	} catch {
		// Cookies blocked: the preference lasts for this page view only.
	}
}
