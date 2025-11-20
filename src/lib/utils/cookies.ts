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
 */
export function getAuthCookieOptions(maxAge: number) {
	return {
		path: '/',
		httpOnly: true,
		secure: !dev, // true in production, false in development
		sameSite: 'lax' as const,
		maxAge
	};
}

/**
 * Access token cookie options (1 hour lifetime)
 */
export function getAccessTokenCookieOptions() {
	return getAuthCookieOptions(60 * 60); // 1 hour
}

/**
 * Refresh token cookie options (30 days lifetime)
 */
export function getRefreshTokenCookieOptions() {
	return getAuthCookieOptions(60 * 60 * 24 * 30); // 30 days
}
