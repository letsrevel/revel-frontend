import type { Handle, HandleFetch } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { env } from '$env/dynamic/private';
import { i18nHandle } from '$lib/i18n';
import { tokenRefresh } from '$lib/api/generated';
import { API_BASE_URL } from '$lib/config/api';
import {
	getAccessTokenCookieOptions,
	getRefreshTokenCookieOptions,
	getRememberMeCookieOptions
} from '$lib/utils/cookies';
import { log } from '$lib/server/logger';
import { startMetricsServer } from '$lib/server/metrics';
import { handleRequestLogging, handleSsrError } from '$lib/server/request-logging';

// Start the internal Prometheus metrics listener (production-only, guarded so
// dev/HMR/tests never bind the port). Importing metrics also registers the
// custom collectors used by the request-logging and error hooks.
startMetricsServer();

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
		log.error('jwt_decode_failed', { error });
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
		log.debug('org_token_captured');
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
		log.debug('event_token_captured');
		event.cookies.set('pending_event_token', eventToken, {
			path: '/',
			httpOnly: true,
			secure: false, // Set to true in production
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 7 // 7 days
		});
	}

	// Check for referral code (?ref=) — new code always prevails
	const referralCode = event.url.searchParams.get('ref');
	if (referralCode) {
		event.cookies.set('referral_code', referralCode, {
			path: '/',
			httpOnly: false, // Readable by client-side JS on the registration page
			secure: false,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 30 // 30 days
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

	log.debug('auth_request', {
		path: event.url.pathname,
		has_access_token: !!accessToken,
		has_refresh_token: !!refreshToken
	});

	// If we have an access token, decode it to populate locals.user
	if (accessToken) {
		try {
			const decoded = decodeJWT(accessToken);

			if (!decoded) {
				log.warning('jwt_malformed', { reason: 'decode_returned_null' });
				// Clear invalid token
				event.cookies.delete('access_token', { path: '/', httpOnly: true, sameSite: 'lax' });
			} else {
				event.locals.user = {
					id: decoded.user_id || decoded.sub,
					email: decoded.email,
					accessToken
				};
			}
		} catch (error) {
			log.warning('jwt_processing_error', { error });
			// Token is malformed, clear it
			event.cookies.delete('access_token', { path: '/', httpOnly: true, sameSite: 'lax' });
		}
	} else if (refreshToken) {
		// No access token but refresh token exists — the access token expired.
		// Refresh it now so locals.user is populated before any load function runs.
		// This fixes 401 errors on cold start with "remember me" enabled.
		log.debug('token_refresh_attempt', { reason: 'cold_start_access_token_missing' });
		const rememberMe = event.cookies.get('remember_me') === 'true';

		try {
			const { data, error: refreshError } = await tokenRefresh({
				body: { refresh: refreshToken }
			});

			if (refreshError || !data || !data.access || !data.refresh) {
				log.warning('token_refresh_failed', { error: refreshError });
				event.cookies.delete('refresh_token', { path: '/', httpOnly: true, sameSite: 'lax' });
				event.cookies.delete('remember_me', { path: '/' });
			} else {
				log.debug('token_refresh_succeeded');

				// Set new cookies
				event.cookies.set('access_token', data.access, getAccessTokenCookieOptions(rememberMe));
				event.cookies.set('refresh_token', data.refresh, getRefreshTokenCookieOptions(rememberMe));
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
			log.error('token_refresh_error', { error });
			// Don't block page load — user will appear logged out
		}
	}

	return resolve(event);
};

/**
 * Combine request logging, token capture, authentication, i18n, and preload
 * optimization hooks. handleRequestLogging is FIRST so it wraps and times the
 * whole chain.
 */
export const handle = sequence(
	handleRequestLogging,
	handleTokenCapture,
	i18nHandle(),
	handleAuth,
	handlePreloadOptimization
);

// Unhandled SSR errors → structured error log + SSR error metric (see module).
export const handleError = handleSsrError;

/**
 * SSR fetch interception
 *
 * When INTERNAL_API_URL is set (production: http://web:8000), API calls made
 * during SSR via the event-scoped `fetch` are rewritten from the public API
 * origin to the internal docker network — skipping the Cloudflare/Caddy
 * round-trip — and carry the real visitor IP in X-Real-IP / X-Forwarded-For,
 * so the backend geolocates ("nearest first"), logs, and rate-limits the
 * visitor instead of this server's egress IP.
 *
 * The public path cannot forward the IP: Caddy deliberately overwrites those
 * headers on any request arriving from outside (anti-spoofing). The visitor IP
 * comes from getClientAddress(), which adapter-node reads from the header
 * configured via ADDRESS_HEADER (set by Caddy on the frontend proxy).
 *
 * When INTERNAL_API_URL is unset (local dev, or as a rollback switch), SSR
 * fetches keep using the public API URL unchanged. See backend issue #487.
 */
export const handleFetch: HandleFetch = async ({ event, request, fetch }) => {
	const internalApiUrl = env.INTERNAL_API_URL;
	if (!internalApiUrl || !request.url.startsWith(API_BASE_URL)) {
		return fetch(request);
	}

	// Buffer the body instead of re-wrapping the Request directly:
	// `new Request(url, request)` turns the body into a stream, which undici
	// sends with `Transfer-Encoding: chunked` and no Content-Length. Django's
	// WSGI layer reads `CONTENT_LENGTH or 0` bytes, so every POST/PATCH body
	// arrived empty (422 "Field required" on login/register). The public path
	// never hit this because Caddy/Cloudflare buffer the request and restore
	// Content-Length; the direct internal path talks to gunicorn unbuffered.
	const body =
		request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer();
	const rewritten = new Request(internalApiUrl + request.url.slice(API_BASE_URL.length), {
		method: request.method,
		headers: request.headers,
		body
	});
	// The visitor's request is always HTTPS in production; without this header
	// Django's SECURE_SSL_REDIRECT 301s internal plain-HTTP calls to
	// https://web:8000, where TLS meets gunicorn's plaintext port and times
	// out — which took every SSR page down on first deploy. Set it
	// unconditionally (not inside the getClientAddress() guard).
	rewritten.headers.set('x-forwarded-proto', 'https');
	// Forward the per-request id so the backend's structlog binds the same
	// request_id — frontend and backend lines for this request line up in Loki.
	if (event.locals.requestId) {
		rewritten.headers.set('x-request-id', event.locals.requestId);
	}
	try {
		const clientIp = event.getClientAddress();
		rewritten.headers.set('x-real-ip', clientIp);
		rewritten.headers.set('x-forwarded-for', clientIp);
	} catch {
		// getClientAddress() throws during prerendering — send without the IP
	}
	return fetch(rewritten);
};
