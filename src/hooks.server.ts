import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { i18nHandle } from '$lib/i18n';
import { tokenRefresh } from '$lib/api/generated';
import {
	getAccessTokenCookieOptions,
	getRefreshTokenCookieOptions,
	getRememberMeCookieOptions
} from '$lib/utils/cookies';

/**
 * Server-side hooks for authentication and internationalization
 *
 * This hook:
 * - Decodes the access token to populate event.locals.user
 * - Refreshes expired access tokens using the refresh token (for cold starts)
 * - Validates token structure
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
 * Preload optimization hook
 * Limits modulepreload Link headers to prevent Chromium/Safari from hanging
 * on pages with many JS chunks (200+ modulepreloads causes browser issues)
 */
const handlePreloadOptimization: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	// Only process HTML responses
	const contentType = response.headers.get('content-type');
	if (!contentType?.includes('text/html')) {
		return response;
	}

	// Get the Link header
	const linkHeader = response.headers.get('link');
	if (!linkHeader) {
		return response;
	}

	// Count modulepreload hints
	const preloadCount = (linkHeader.match(/modulepreload/g) || []).length;

	// If too many preloads, limit them to prevent browser hanging
	// Chromium and Safari hang with 200+ modulepreloads
	const MAX_PRELOADS = 50;
	if (preloadCount > MAX_PRELOADS) {
		// Parse Link header and keep only first MAX_PRELOADS modulepreloads
		const links = linkHeader.split(',').map((l) => l.trim());
		const modulePreloads: string[] = [];
		const otherLinks: string[] = [];

		for (const link of links) {
			if (link.includes('modulepreload')) {
				if (modulePreloads.length < MAX_PRELOADS) {
					modulePreloads.push(link);
				}
			} else {
				otherLinks.push(link);
			}
		}

		// Create new response with limited Link header
		const newHeaders = new Headers(response.headers);
		const newLinkHeader = [...otherLinks, ...modulePreloads].join(', ');
		newHeaders.set('link', newLinkHeader);

		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers: newHeaders
		});
	}

	return response;
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
	if (accessToken) {
		console.log('[HOOKS] Access token exists, decoding JWT');
		try {
			const decoded = decodeJWT(accessToken);

			if (!decoded) {
				console.error('[HOOKS] Failed to decode JWT, token may be malformed');
				// Clear invalid token
				event.cookies.delete('access_token', { path: '/', httpOnly: true, sameSite: 'lax' });
			} else {
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
	} else if (refreshToken) {
		// No access token but refresh token exists — the access token expired.
		// Refresh it now so locals.user is populated before any load function runs.
		// This fixes 401 errors on cold start with "remember me" enabled.
		console.log('[HOOKS] No access token but refresh token exists, attempting refresh');
		const rememberMe = event.cookies.get('remember_me') === 'true';

		try {
			const { data, error: refreshError } = await tokenRefresh({
				body: { refresh: refreshToken }
			});

			if (refreshError || !data || !data.access || !data.refresh) {
				console.error('[HOOKS] Token refresh failed:', refreshError);
				event.cookies.delete('refresh_token', { path: '/', httpOnly: true, sameSite: 'lax' });
				event.cookies.delete('remember_me', { path: '/' });
			} else {
				console.log('[HOOKS] Token refresh successful');

				// Set new cookies
				event.cookies.set('access_token', data.access, getAccessTokenCookieOptions(rememberMe));
				event.cookies.set(
					'refresh_token',
					data.refresh,
					getRefreshTokenCookieOptions(rememberMe)
				);
				event.cookies.set(
					'remember_me',
					rememberMe ? 'true' : 'false',
					getRememberMeCookieOptions(rememberMe)
				);

				// Decode the new access token and populate locals.user
				const decoded = decodeJWT(data.access);
				if (decoded) {
					event.locals.user = {
						id: decoded.user_id || decoded.sub,
						email: decoded.email,
						accessToken: data.access
					};
				}
			}
		} catch (error) {
			console.error('[HOOKS] Token refresh error:', error);
			// Don't block page load — user will appear logged out
		}
	}

	return resolve(event);
};

/**
 * Combine token capture, authentication, i18n, and preload optimization hooks
 * Note: handlePreloadOptimization must be FIRST to properly intercept responses
 */
export const handle = sequence(
	handleTokenCapture,
	i18nHandle(),
	handleAuth,
	handlePreloadOptimization
);
