import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { tokenRefresh } from '$lib/api/generated';

/**
 * Server-side API endpoint to refresh JWT access token
 * Reads refresh token from httpOnly cookie and returns new access token
 *
 * This endpoint is called by the client-side API interceptor when a 401 is received
 * The client can't access the httpOnly refresh token cookie directly,
 * so this server endpoint handles the refresh logic
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

	try {
		// Call backend to refresh the token
		const { data, error: refreshError } = await tokenRefresh({
			body: {
				refresh: refreshToken
			}
		});

		if (refreshError || !data || !data.access) {
			console.error('[API /auth/refresh] Token refresh failed:', refreshError);
			// Invalid refresh token, clear both cookies
			cookies.delete('refresh_token', { path: '/', httpOnly: true, sameSite: 'lax' });
			cookies.delete('access_token', { path: '/', httpOnly: true, sameSite: 'lax' });
			throw error(401, 'Token refresh failed');
		}

		console.log('[API /auth/refresh] Token refresh successful');

		// Update the access token cookie
		cookies.set('access_token', data.access, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 15 // 15 minutes
		});

		// Also update refresh token if backend returned a new one
		if (data.refresh) {
			cookies.set('refresh_token', data.refresh, {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				maxAge: 60 * 60 * 24 * 7 // 7 days (typical refresh token expiry)
			});
		}

		// Return the new access token to the client
		return json({
			access: data.access,
			refresh: data.refresh || refreshToken
		});
	} catch (err) {
		console.error('[API /auth/refresh] Error during token refresh:', err);
		// Clear invalid tokens
		cookies.delete('refresh_token', { path: '/', httpOnly: true, sameSite: 'lax' });
		cookies.delete('access_token', { path: '/', httpOnly: true, sameSite: 'lax' });
		throw error(500, 'Internal server error during token refresh');
	}
};
