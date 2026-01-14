import type { LayoutServerLoad } from './$types';
import {
	getAccessTokenCookieOptions,
	getRefreshTokenCookieOptions,
	getRememberMeCookieOptions
} from '$lib/utils/cookies';

/**
 * Root layout server load function
 * Passes access token from httpOnly cookie to client for auth initialization
 *
 * IMPORTANT: This also handles proactive token refresh on page load.
 * When a user returns after the 1-hour access token expired but their
 * 30-day refresh token is still valid (Remember Me was checked),
 * we refresh the token server-side so the page loads already authenticated.
 * This prevents a "flash" of logged-out content.
 */
export const load: LayoutServerLoad = async ({ cookies, url, fetch }) => {
	let accessToken = cookies.get('access_token');
	const refreshToken = cookies.get('refresh_token');
	const rememberMe = cookies.get('remember_me') === 'true';

	console.log('[LAYOUT.SERVER] Loading for path:', url.pathname, {
		hasAccessToken: !!accessToken,
		hasRefreshToken: !!refreshToken,
		rememberMe,
		accessTokenLength: accessToken?.length || 0
	});

	// Proactive token refresh: If we have a refresh token but no access token,
	// the access token expired and we should refresh it now
	// This happens when user returns after 1+ hours but within 30 days (Remember Me)
	if (!accessToken && refreshToken) {
		console.log('[LAYOUT.SERVER] No access token but refresh token exists, attempting refresh');

		try {
			// Call our own API endpoint which handles the refresh
			// We use the internal fetch which includes credentials
			const response = await fetch('/api/auth/refresh', {
				method: 'POST',
				credentials: 'include'
			});

			if (response.ok) {
				const data = await response.json();

				if (data.access && data.refresh) {
					console.log('[LAYOUT.SERVER] Token refresh successful');

					// Set the new tokens as cookies
					cookies.set('access_token', data.access, getAccessTokenCookieOptions(rememberMe));
					cookies.set('refresh_token', data.refresh, getRefreshTokenCookieOptions(rememberMe));
					cookies.set(
						'remember_me',
						rememberMe ? 'true' : 'false',
						getRememberMeCookieOptions(rememberMe)
					);

					// Update the access token variable for the return value
					accessToken = data.access;
				}
			} else {
				console.log('[LAYOUT.SERVER] Token refresh failed with status:', response.status);
				// Clear invalid tokens
				cookies.delete('refresh_token', { path: '/' });
				cookies.delete('remember_me', { path: '/' });
			}
		} catch (error) {
			console.error('[LAYOUT.SERVER] Token refresh error:', error);
			// Don't block page load on refresh failure
			// User will just appear logged out
		}
	}

	return {
		auth: {
			accessToken: accessToken || null,
			hasRefreshToken: !!refreshToken
		}
	};
};
