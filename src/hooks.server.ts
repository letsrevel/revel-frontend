import type { Handle } from '@sveltejs/kit';
import { tokenRefresh } from '$lib/api/generated';

/**
 * Server-side hooks for authentication
 * Handles JWT refresh token management via httpOnly cookies
 */
export const handle: Handle = async ({ event, resolve }) => {
	const accessToken = event.cookies.get('access_token');
	const refreshToken = event.cookies.get('refresh_token');

	console.log('[HOOKS] Request:', {
		url: event.url.pathname,
		hasAccessToken: !!accessToken,
		hasRefreshToken: !!refreshToken
	});

	// If no access token but refresh token exists, try to refresh
	if (!accessToken && refreshToken) {
		console.log('[HOOKS] No access token but refresh token exists, attempting refresh');
		try {
			const { data, error } = await tokenRefresh({
				body: {
					refresh: refreshToken
				}
			});

			if (error || !data || !data.access) {
				console.error('[HOOKS] Token refresh failed:', error);
				// Invalid refresh token, clear it
				event.cookies.delete('refresh_token', { path: '/', httpOnly: true, sameSite: 'lax' });
				event.cookies.delete('access_token', { path: '/', httpOnly: true, sameSite: 'lax' });
			} else {
				console.log('[HOOKS] Token refresh successful, setting new access token');
				// Set the new access token cookie
				event.cookies.set('access_token', data.access, {
					path: '/',
					httpOnly: true,
					sameSite: 'lax',
					maxAge: 60 * 15 // 15 minutes (typical JWT expiry)
				});
			}
		} catch (error) {
			console.error('[HOOKS] Token refresh error:', error);
			// Clear invalid tokens
			event.cookies.delete('refresh_token', { path: '/', httpOnly: true, sameSite: 'lax' });
			event.cookies.delete('access_token', { path: '/', httpOnly: true, sameSite: 'lax' });
		}
	}

	// Resolve the request
	const response = await resolve(event);

	return response;
};
