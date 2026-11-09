import type { Cookies } from '@sveltejs/kit';
import { tokenLogout } from '$lib/api/generated';
import { log } from '$lib/server/logger';

/** Upper bound for the best-effort server-side revoke: a hung backend must never block sign-out. */
export const REVOKE_TIMEOUT_MS = 3000;

/** The slice of a SvelteKit request event these helpers need. */
export interface AuthCookieEvent {
	cookies: Cookies;
	fetch: typeof fetch;
}

/**
 * Revoke the browser's refresh token on the backend (`POST /api/auth/logout`,
 * #1199), killing the whole login lineage. The token is read from the httpOnly
 * cookie here and never reaches client JS.
 *
 * Best effort and bounded: any failure (network, timeout, 404 from a backend
 * that predates the endpoint, 401 for an already invalid token) is logged at
 * warn and swallowed, so the caller can always go on to clear the cookies.
 * Call it BEFORE the cookie is deleted or replaced.
 */
export async function revokeRefreshToken(event: AuthCookieEvent): Promise<void> {
	const refreshToken = event.cookies.get('refresh_token');
	if (!refreshToken) return;
	try {
		const { error, response } = await tokenLogout({
			body: { refresh: refreshToken },
			fetch: event.fetch,
			signal: AbortSignal.timeout(REVOKE_TIMEOUT_MS)
		});
		if (error) {
			log.warning('logout_revoke_failed', { upstream_status: response?.status });
		}
	} catch (err) {
		log.warning('logout_revoke_failed', { error: err });
	}
}

/** Delete the three auth cookies (access, refresh, "remember me" preference). */
export function clearAuthCookies(cookies: Cookies): void {
	cookies.delete('access_token', { path: '/' });
	cookies.delete('refresh_token', { path: '/' });
	cookies.delete('remember_me', { path: '/' });
}

/** Revoke the refresh token server-side, then clear every auth cookie. */
export async function revokeAndClearSession(event: AuthCookieEvent): Promise<void> {
	await revokeRefreshToken(event);
	clearAuthCookies(event.cookies);
}
