import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Hand the current access token from the httpOnly `access_token` cookie to the
 * authenticated client so it can populate its in-memory auth store.
 *
 * Why this exists
 * ---------------
 * The access token is deliberately NOT serialized into the SSR HTML (see
 * +layout.server.ts) — the client normally bootstraps its in-memory store by
 * calling `/api/auth/refresh`, which mints a fresh token from the httpOnly
 * refresh cookie. But IMPERSONATION sessions are issued with an access cookie
 * and NO refresh cookie (impersonate/+page.server.ts), so `/api/auth/refresh`
 * 401s for them. This endpoint returns the existing access-cookie token
 * without minting a new one, which is the only way to load an impersonation
 * token into memory after the SSR-token migration.
 *
 * Security: the token is returned in a JSON body (never in the document) —
 * identical exposure to `/api/auth/refresh`'s response. The endpoint is
 * same-origin; a cross-origin page can trigger the request with the cookie but
 * cannot read the response (CORS), so it cannot exfiltrate the token. The
 * backend validates the token on use, so a stale/expired cookie just leads to
 * the normal 401 → refresh/logout path.
 */
export const GET: RequestHandler = async ({ cookies }) => {
	const accessToken = cookies.get('access_token');

	if (!accessToken) {
		throw error(401, 'No access token cookie');
	}

	// Never let an intermediary (proxy/CDN) cache a bearer-token response and
	// hand it to another client.
	return json({ access: accessToken }, { headers: { 'Cache-Control': 'no-store, private' } });
};
