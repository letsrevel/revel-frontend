import type { Cookies } from '@sveltejs/kit';
import {
	getAccessTokenCookieOptions,
	getRefreshTokenCookieOptions,
	getRememberMeCookieOptions
} from '$lib/utils/cookies';
import { claimPendingTokens, setClaimFlashCookie } from '$lib/server/token-claim';

export interface SessionTokens {
	access: string;
	refresh: string;
}

/**
 * Turn a fresh access/refresh pair into a logged-in browser session: set the
 * three auth cookies and claim any pending invitation tokens (org/event),
 * leaving the claim flash cookie for the destination page.
 *
 * The redirect stays at the call site — the login actions redirect to the
 * page's `?returnUrl`, the OIDC callback to the exchange response's
 * `return_url` (both through `safeReturnUrl`).
 */
export async function establishSession(
	cookies: Cookies,
	tokens: SessionTokens,
	rememberMe: boolean,
	fetchFn: typeof fetch
): Promise<void> {
	cookies.set('access_token', tokens.access, getAccessTokenCookieOptions(rememberMe));
	cookies.set('refresh_token', tokens.refresh, getRefreshTokenCookieOptions(rememberMe));
	cookies.set(
		'remember_me',
		rememberMe ? 'true' : 'false',
		getRememberMeCookieOptions(rememberMe)
	);

	const claimResults = await claimPendingTokens(cookies, tokens.access, fetchFn);
	setClaimFlashCookie(cookies, claimResults);
}
