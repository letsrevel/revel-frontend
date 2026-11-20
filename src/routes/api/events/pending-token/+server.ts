import type { RequestHandler } from './$types';
import { getAuthCookieOptions } from '$lib/utils/cookies';

/**
 * Forget the pending event token after the user claimed it.
 *
 * `hooks.server.ts` keeps the `?et=` token in the httpOnly `pending_event_token`
 * cookie for 7 days, and the event page reads that cookie. While the cookie is
 * set, the page offers the "Claim invitation" button. After a successful claim
 * the client calls this endpoint, so the reload shows the real next step and
 * not the claim button again (the claim loop of #1115 and #1274).
 *
 * The cookie is httpOnly, so only the server can delete it. The `token` query
 * parameter must match the cookie: a claim on one event's page never clears a
 * token that the user has for another event. DELETE is not a "simple" request,
 * so a cross-origin page cannot send it without a CORS preflight that fails.
 */
export const DELETE: RequestHandler = async ({ cookies, url }) => {
	const token = url.searchParams.get('token');
	if (token && cookies.get('pending_event_token') === token) {
		// Same attributes as the set in hooks.server.ts: a Secure delete would be
		// dropped by the browser over plain http (dev on a LAN IP).
		cookies.delete('pending_event_token', getAuthCookieOptions());
	}
	return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
};
