import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { i18nHandle } from '$lib/i18n';

/**
 * Server-side hooks for authentication and internationalization
 *
 * IMPORTANT: This hook does NOT perform token refresh to avoid race conditions
 * with client-side refresh mechanisms. Token refresh is handled exclusively by:
 * 1. Client-side API interceptor (catches 401 errors)
 * 2. Client-side auto-refresh timer (proactive refresh before expiry)
 *
 * This hook only:
 * - Decodes the access token to populate event.locals.user
 * - Validates token structure (not expiry)
 * - Clears invalid tokens
 * - Detects and sets user language preference
 */

/**
 * Decode JWT token to extract user information
 * Note: This is safe as JWT is just base64 encoded, not encrypted
 */
function decodeJWT(token: string): any | null {
	try {
		const parts = token.split('.');
		if (parts.length !== 3) return null;

		// Decode the payload (second part)
		const payload = parts[1];
		const decoded = Buffer.from(payload, 'base64url').toString('utf-8');
		return JSON.parse(decoded);
	} catch (error) {
		console.error('[HOOKS] Failed to decode JWT:', error);
		return null;
	}
}

/**
 * Token capture hook - stores invitation tokens from URL params in cookies
 */
const handleTokenCapture: Handle = async ({ event, resolve }) => {
	// Check for organization token (?ot=)
	const orgToken = event.url.searchParams.get('ot');
	if (orgToken) {
		console.log('[HOOKS] Organization token detected, storing in cookie');
		event.cookies.set('pending_org_token', orgToken, {
			path: '/',
			httpOnly: true,
			secure: false, // Set to true in production
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 7 // 7 days
		});
	}

	// Check for event token (?et=)
	const eventToken = event.url.searchParams.get('et');
	if (eventToken) {
		console.log('[HOOKS] Event token detected, storing in cookie');
		event.cookies.set('pending_event_token', eventToken, {
			path: '/',
			httpOnly: true,
			secure: false, // Set to true in production
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 7 // 7 days
		});
	}

	return resolve(event);
};

/**
 * Authentication hook
 */
const handleAuth: Handle = async ({ event, resolve }) => {
	const accessToken = event.cookies.get('access_token');
	const refreshToken = event.cookies.get('refresh_token');

	console.log('[HOOKS] Request:', {
		url: event.url.pathname,
		hasAccessToken: !!accessToken,
		hasRefreshToken: !!refreshToken
	});

	// If we have an access token, decode it to populate locals.user
	// We do NOT check expiry here - let the client handle refresh
	if (accessToken) {
		console.log('[HOOKS] Access token exists, decoding JWT');
		try {
			const decoded = decodeJWT(accessToken);

			if (!decoded) {
				console.error('[HOOKS] Failed to decode JWT, token may be malformed');
				// Clear invalid token
				event.cookies.delete('access_token', { path: '/', httpOnly: true, sameSite: 'lax' });
			} else {
				// Populate locals.user from decoded JWT
				// Note: We don't check expiry - expired tokens will trigger 401
				// and client-side refresh will handle it
				console.log('[HOOKS] JWT decoded successfully');
				event.locals.user = {
					id: decoded.user_id || decoded.sub,
					email: decoded.email,
					accessToken
				};
			}
		} catch (error) {
			console.error('[HOOKS] Error processing JWT:', error);
			// Token is malformed, clear it
			event.cookies.delete('access_token', { path: '/', httpOnly: true, sameSite: 'lax' });
		}
	}

	return resolve(event);
};

/**
 * Combine token capture, authentication, and i18n hooks
 */
export const handle = sequence(handleTokenCapture, i18nHandle(), handleAuth);
