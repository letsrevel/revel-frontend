import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { tokenRefresh } from '$lib/api/generated';
import { getAccessTokenCookieOptions, getRefreshTokenCookieOptions } from '$lib/utils/cookies';

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
 */
export const POST: RequestHandler = async ({ cookies }) => {
	const refreshToken = cookies.get('refresh_token');

	// No refresh token available
	if (!refreshToken) {
		console.log('[API /auth/refresh] No refresh token cookie found');
		// Clear any stale access token
		cookies.delete('access_token', { path: '/', httpOnly: true, sameSite: 'lax' });
		throw error(401, 'No refresh token available');
	}

	console.log('[API /auth/refresh] Attempting token refresh');

	try {
		// Call backend to refresh the token
		const { data, error: refreshError } = await tokenRefresh({
			body: {
				refresh: refreshToken
			}
		});

		if (refreshError || !data || !data.access) {
			console.error('[API /auth/refresh] Token refresh failed:', refreshError);
			// Invalid or blacklisted refresh token, clear both cookies
			cookies.delete('refresh_token', { path: '/', httpOnly: true, sameSite: 'lax' });
			cookies.delete('access_token', { path: '/', httpOnly: true, sameSite: 'lax' });
			throw error(401, 'Token refresh failed');
		}

		console.log('[API /auth/refresh] Token refresh successful', {
			hasNewAccessToken: !!data.access,
			hasNewRefreshToken: !!data.refresh
		});

		// CRITICAL: Backend returns BOTH new access and refresh tokens
		// The old refresh token is now blacklisted - we MUST save the new one

		// Set the new access token cookie (1 hour lifetime)
		cookies.set('access_token', data.access, getAccessTokenCookieOptions());

		// CRITICAL: Always update refresh token - backend rotates it on every refresh
		if (!data.refresh) {
			console.error('[API /auth/refresh] Backend did not return new refresh token!');
			throw error(500, 'Backend did not return new refresh token');
		}

		cookies.set('refresh_token', data.refresh, getRefreshTokenCookieOptions());

		// Return the new tokens to the client
		// Client needs access token to update its in-memory store
		return json({
			access: data.access,
			refresh: data.refresh
		});
	} catch (err) {
		console.error('[API /auth/refresh] Error during token refresh:', err);
		// Clear invalid tokens
		cookies.delete('refresh_token', { path: '/', httpOnly: true, sameSite: 'lax' });
		cookies.delete('access_token', { path: '/', httpOnly: true, sameSite: 'lax' });

		// Re-throw if already an HttpError
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		throw error(500, 'Internal server error during token refresh');
	}
};
