import { createHash } from 'node:crypto';
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { tokenRefresh } from '$lib/api/generated';
import {
	getAccessTokenCookieOptions,
	getRefreshTokenCookieOptions,
	getRememberMeCookieOptions
} from '$lib/utils/cookies';

/**
 * Server-side API endpoint to refresh JWT access token
 *
 * IMPORTANT: The backend uses rotating refresh tokens with blacklisting:
 * - Each refresh returns a NEW access token AND a NEW refresh token
 * - The old refresh token is immediately blacklisted (single-use)
 * - We MUST save both tokens to avoid using a blacklisted token
 *
 * This endpoint is called by:
 * 1. Client-side API interceptor when a 401 is received
 * 2. Client-side auto-refresh timer before token expiry
 *
 * The client can't access the httpOnly refresh token cookie directly,
 * so this server endpoint reads it and calls the backend.
 *
 * The request-scoped `fetch` MUST be forwarded to the SDK call (see #883).
 * Without it the generated client falls back to `globalThis.fetch`, which
 * `handleFetch` never sees — so the refresh is not rewritten to
 * INTERNAL_API_URL. In containerized deployments where the browser-facing API
 * origin is unreachable from the frontend container, that makes sign-in appear
 * to succeed and then silently fall back to logged-out.
 *
 * A REJECTED refresh never deletes the cookies (#950). The rejection only
 * proves that the cookie *this request* carried was stale — a concurrent
 * request (another tab, an SSR refresh in hooks.server.ts) may already have
 * rotated it, and a deletion arriving after that rotation's Set-Cookie would
 * wipe the fresh refresh token and log the user out. Instead the 401 carries
 * a fingerprint of the rejected token; once the client's heal retry confirms
 * the rejection, it sends that fingerprint to DELETE, which clears the cookies
 * only if the browser still holds that same dead token.
 */
export const POST: RequestHandler = async ({ cookies, fetch }) => {
	const refreshToken = cookies.get('refresh_token');
	// Read the "remember me" preference to preserve cookie behavior
	const rememberMe = cookies.get('remember_me') === 'true';

	// No refresh token available
	if (!refreshToken) {
		// Clear any stale access token
		cookies.delete('access_token', { path: '/', httpOnly: true, sameSite: 'lax' });
		throw error(401, 'No refresh token available');
	}

	try {
		// Call backend to refresh the token
		const {
			data,
			error: refreshError,
			response
		} = await tokenRefresh({
			body: {
				refresh: refreshToken
			},
			fetch
		});

		if (refreshError || !data || !data.access) {
			console.error('[API /auth/refresh] Token refresh failed:', refreshError);
			// Leave the cookies alone either way: see the note above POST.
			if (response?.status === 401) {
				// The backend rejected THIS token (invalid, expired or blacklisted).
				return json(
					{ message: 'Token refresh failed', rejected: fingerprint(refreshToken) },
					{ status: 401, headers: { 'Cache-Control': 'no-store, private' } }
				);
			}
			// Anything else (5xx, unexpected status) says nothing about the token:
			// no fingerprint, so the client never clears a possibly valid cookie.
			return json(
				{ message: 'Token refresh unavailable' },
				{ status: 502, headers: { 'Cache-Control': 'no-store, private' } }
			);
		}

		// CRITICAL: Backend returns BOTH new access and refresh tokens
		// The old refresh token is now blacklisted - we MUST save the new one

		// Set the new access token cookie (1 hour lifetime)
		cookies.set('access_token', data.access, getAccessTokenCookieOptions(rememberMe));

		// CRITICAL: Always update refresh token - backend rotates it on every refresh
		if (!data.refresh) {
			console.error('[API /auth/refresh] Backend did not return new refresh token!');
			throw error(500, 'Backend did not return new refresh token');
		}

		// Preserve the "remember me" behavior: persistent or session cookie
		cookies.set('refresh_token', data.refresh, getRefreshTokenCookieOptions(rememberMe));

		// Also refresh the remember_me cookie to maintain consistency
		cookies.set(
			'remember_me',
			rememberMe ? 'true' : 'false',
			getRememberMeCookieOptions(rememberMe)
		);

		// Return ONLY the access token to the client. The refresh token stays in
		// the httpOnly cookie set above and must never be exposed to client JS
		// (the in-memory store only consumes `access`).
		return json(
			{
				access: data.access
			},
			{ headers: { 'Cache-Control': 'no-store, private' } }
		);
	} catch (err) {
		console.error('[API /auth/refresh] Error during token refresh:', err);
		// Don't clear the cookies: a transient failure says nothing about whether
		// the refresh token is still valid.

		// Re-throw if already an HttpError
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		throw error(500, 'Internal server error during token refresh');
	}
};

/**
 * A one-way fingerprint of a refresh token, safe to hand to client JS: it
 * identifies a token without revealing it.
 */
function fingerprint(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

/**
 * Clear the auth cookies after a refresh was definitively rejected — but only
 * when the browser still holds the token that was rejected (`rejected` is the
 * fingerprint from POST's 401). If another tab or request rotated the cookie in
 * the meantime, the fresh token is left in place.
 */
export const DELETE: RequestHandler = async ({ cookies, request }) => {
	const body: unknown = await request.json().catch(() => null);
	const rejected =
		body && typeof body === 'object' && 'rejected' in body && typeof body.rejected === 'string'
			? body.rejected
			: null;
	const refreshToken = cookies.get('refresh_token');

	if (rejected && refreshToken && fingerprint(refreshToken) === rejected) {
		cookies.delete('refresh_token', { path: '/', httpOnly: true, sameSite: 'lax' });
		cookies.delete('access_token', { path: '/', httpOnly: true, sameSite: 'lax' });
		cookies.delete('remember_me', { path: '/' });
		return json({ cleared: true });
	}
	return json({ cleared: false });
};
