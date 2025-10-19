import type { Handle } from '@sveltejs/kit';
import { tokenRefresh, accountMeD8441F6B } from '$lib/api/generated';

/**
 * Server-side hooks for authentication
 * Handles JWT refresh token management via httpOnly cookies
 * Populates event.locals.user for server-side load functions
 */
export const handle: Handle = async ({ event, resolve }) => {
	let accessToken = event.cookies.get('access_token');
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
				// Update accessToken variable so we can fetch user data below
				accessToken = data.access;
			}
		} catch (error) {
			console.error('[HOOKS] Token refresh error:', error);
			// Clear invalid tokens
			event.cookies.delete('refresh_token', { path: '/', httpOnly: true, sameSite: 'lax' });
			event.cookies.delete('access_token', { path: '/', httpOnly: true, sameSite: 'lax' });
		}
	}

	// If we have an access token, fetch user data and populate locals.user
	if (accessToken) {
		console.log('[HOOKS] Access token exists, fetching user data');
		try {
			const { data, error } = await accountMeD8441F6B({
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (error || !data) {
				console.error('[HOOKS] Failed to fetch user data:', error);
				// Token is invalid, clear cookies
				event.cookies.delete('access_token', { path: '/', httpOnly: true, sameSite: 'lax' });
				event.cookies.delete('refresh_token', { path: '/', httpOnly: true, sameSite: 'lax' });
			} else {
				console.log('[HOOKS] User data fetched successfully:', data.email);
				// Populate locals.user for server-side load functions
				event.locals.user = {
					...data,
					accessToken
				};
			}
		} catch (error) {
			console.error('[HOOKS] Error fetching user data:', error);
			// Token is invalid, clear cookies
			event.cookies.delete('access_token', { path: '/', httpOnly: true, sameSite: 'lax' });
			event.cookies.delete('refresh_token', { path: '/', httpOnly: true, sameSite: 'lax' });
		}
	}

	// Resolve the request
	const response = await resolve(event);

	return response;
};
