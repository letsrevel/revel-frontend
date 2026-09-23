/**
 * Transport for the client's token refresh (#950).
 *
 * The backend rotates refresh tokens and blacklists the old one, so two
 * refreshes that read the same cookie can't both succeed. This module:
 *
 * 1. Serialises refreshes across tabs with the Web Locks API, so tabs whose
 *    timers or 401 interceptors fire together rotate one after the other, each
 *    with the then-current cookie. (Within a tab the auth store already shares
 *    one in-flight promise.) Browsers without `navigator.locks` run unlocked.
 * 2. Heals a lost race it can't serialise (an SSR refresh in hooks.server.ts,
 *    or a reload landing mid-rotation): a 401 is retried once after a short
 *    delay, by which time the winner's Set-Cookie has landed.
 * 3. Clears a refresh cookie proven dead. The server no longer deletes cookies
 *    on a rejected refresh — that deletion could wipe a concurrent winner's
 *    fresh token. When the retry is rejected too, the 401's `rejected`
 *    fingerprint is sent to DELETE /api/auth/refresh, which clears the cookies
 *    only if the browser still holds that same token.
 */

const REFRESH_ENDPOINT = '/api/auth/refresh';
export const REFRESH_LOCK_NAME = 'revel-token-refresh';
export const REFRESH_RETRY_DELAY_MS = 400;

/** Run `fn` while holding the cross-tab refresh lock, when the browser has one. */
export async function withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
	const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
	if (!locks || typeof locks.request !== 'function') return fn();
	return locks.request(REFRESH_LOCK_NAME, fn);
}

function postRefresh(): Promise<Response> {
	return fetch(REFRESH_ENDPOINT, { method: 'POST', credentials: 'include' });
}

async function rejectedFingerprint(response: Response): Promise<string | null> {
	try {
		const body: unknown = await response.clone().json();
		if (body && typeof body === 'object' && 'rejected' in body) {
			return typeof body.rejected === 'string' ? body.rejected : null;
		}
	} catch {
		// No JSON body (e.g. "no refresh cookie" 401) — nothing to clear.
	}
	return null;
}

async function clearRejectedRefreshCookie(response: Response): Promise<void> {
	const rejected = await rejectedFingerprint(response);
	if (!rejected) return;
	try {
		await fetch(REFRESH_ENDPOINT, {
			method: 'DELETE',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ rejected })
		});
	} catch {
		// Best effort: the cookie expires on its own; the refresh still failed.
	}
}

/**
 * POST /api/auth/refresh under the cross-tab lock, retrying a 401 once, and
 * returns the final response for the caller to interpret.
 */
export function requestTokenRefresh(retryDelayMs = REFRESH_RETRY_DELAY_MS): Promise<Response> {
	return withRefreshLock(async () => {
		let response = await postRefresh();
		if (response.status !== 401) return response;

		await new Promise((resolve) => {
			setTimeout(resolve, retryDelayMs);
		});
		response = await postRefresh();
		if (response.status === 401) await clearRejectedRefreshCookie(response);
		return response;
	});
}
