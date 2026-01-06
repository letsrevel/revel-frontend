/**
 * Cookie utility functions for server-side cookie management
 */

import { dev } from '$app/environment';

/**
 * Get cookie options for authentication tokens
 *
 * IMPORTANT: In production with HTTPS, cookies MUST use secure: true
 * Otherwise browsers may not persist httpOnly cookies correctly.
 *
 * The `dev` flag from $app/environment is true in development mode (npm run dev)
 * and false in production builds.
 *
 * @param maxAge - The maximum age in seconds, or undefined for session cookies
 */
export function getAuthCookieOptions(maxAge?: number) {
	const options: {
		path: string;
		httpOnly: boolean;
		secure: boolean;
		sameSite: 'lax';
		maxAge?: number;
	} = {
		path: '/',
		httpOnly: true,
		secure: !dev, // true in production, false in development
		sameSite: 'lax' as const
	};

	// Only set maxAge if provided - omitting it creates a session cookie
	// that expires when the browser is closed
	if (maxAge !== undefined) {
		options.maxAge = maxAge;
	}

	return options;
}

/**
 * Access token cookie options (1 hour lifetime, or session cookie)
 * @param rememberMe - If true, cookie persists for 1 hour. If false, cookie is session-only.
 */
export function getAccessTokenCookieOptions(rememberMe: boolean = true) {
	// Access token always has maxAge since it's short-lived (1 hour)
	// The rememberMe flag affects the refresh token, not the access token
	return getAuthCookieOptions(60 * 60); // 1 hour
}

/**
 * Refresh token cookie options
 * @param rememberMe - If true, cookie persists for 30 days. If false, cookie is session-only.
 *
 * When rememberMe is false, the refresh token cookie becomes a "session cookie"
 * that is deleted when the browser is closed. This means the user will need to
 * log in again after closing their browser.
 *
 * When rememberMe is true, the cookie persists for 30 days (matching the backend
 * token lifetime), keeping the user logged in across browser sessions.
 */
export function getRefreshTokenCookieOptions(rememberMe: boolean = true) {
	if (rememberMe) {
		return getAuthCookieOptions(60 * 60 * 24 * 30); // 30 days
	}
	// Session cookie - no maxAge, expires when browser closes
	return getAuthCookieOptions(undefined);
}

/**
 * "Remember me" preference cookie options
 * This cookie stores the user's "remember me" preference so we can honor it
 * during token refresh operations.
 *
 * @param rememberMe - The user's preference
 */
export function getRememberMeCookieOptions(rememberMe: boolean) {
	return {
		path: '/',
		httpOnly: false, // Can be read by client if needed
		secure: !dev,
		sameSite: 'lax' as const,
		// Match the refresh token behavior - persistent if remembered, session if not
		...(rememberMe ? { maxAge: 60 * 60 * 24 * 30 } : {})
	};
}
