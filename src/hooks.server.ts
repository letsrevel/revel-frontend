import type { Handle } from '@sveltejs/kit';
import { tokenRefresh } from '$lib/api/generated';

/**
 * Server-side hooks for authentication
 * Handles JWT refresh token management via httpOnly cookies
 * Populates event.locals.user for server-side load functions
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

	// If we have an access token, decode it to populate locals.user
	if (accessToken) {
		console.log('[HOOKS] Access token exists, decoding JWT');
		try {
			const decoded = decodeJWT(accessToken);

			if (!decoded) {
				console.error('[HOOKS] Failed to decode JWT, token may be invalid');
				// Clear invalid token
				event.cookies.delete('access_token', { path: '/', httpOnly: true, sameSite: 'lax' });
			} else {
				// Check if token is expired
				const now = Math.floor(Date.now() / 1000);
				if (decoded.exp && decoded.exp < now) {
					console.log('[HOOKS] Access token expired, attempting refresh');
					// Token expired, try to refresh if we have a refresh token
					if (refreshToken) {
						try {
							const refreshResponse = await tokenRefresh({
								body: {
									refresh: refreshToken
								}
							});

							if (refreshResponse.error || !refreshResponse.data || !refreshResponse.data.access) {
								console.error('[HOOKS] Token refresh failed:', refreshResponse.error);
								// Invalid refresh token, clear all cookies
								event.cookies.delete('refresh_token', {
									path: '/',
									httpOnly: true,
									sameSite: 'lax'
								});
								event.cookies.delete('access_token', {
									path: '/',
									httpOnly: true,
									sameSite: 'lax'
								});
							} else {
								console.log('[HOOKS] Token refresh successful');
								// Set the new access token cookie
								event.cookies.set('access_token', refreshResponse.data.access, {
									path: '/',
									httpOnly: true,
									sameSite: 'lax',
									maxAge: 60 * 15 // 15 minutes
								});

								// Decode the new token
								const newDecoded = decodeJWT(refreshResponse.data.access);
								if (newDecoded) {
									console.log('[HOOKS] JWT decoded successfully after refresh');
									event.locals.user = {
										id: newDecoded.user_id || newDecoded.sub,
										email: newDecoded.email,
										accessToken: refreshResponse.data.access
									};
								}
							}
						} catch (refreshError) {
							console.error('[HOOKS] Error during token refresh:', refreshError);
							// Clear invalid tokens
							event.cookies.delete('refresh_token', { path: '/', httpOnly: true, sameSite: 'lax' });
							event.cookies.delete('access_token', { path: '/', httpOnly: true, sameSite: 'lax' });
						}
					} else {
						// No refresh token available, clear access token
						console.log('[HOOKS] No refresh token available, clearing access token');
						event.cookies.delete('access_token', { path: '/', httpOnly: true, sameSite: 'lax' });
					}
				} else {
					// Token is valid, populate locals.user from decoded JWT
					console.log('[HOOKS] JWT decoded successfully');
					event.locals.user = {
						id: decoded.user_id || decoded.sub,
						email: decoded.email,
						accessToken
					};
				}
			}
		} catch (error) {
			console.error('[HOOKS] Error processing JWT:', error);
			// Token is invalid, clear cookies
			event.cookies.delete('access_token', { path: '/', httpOnly: true, sameSite: 'lax' });
			event.cookies.delete('refresh_token', { path: '/', httpOnly: true, sameSite: 'lax' });
		}
	}

	// Resolve the request
	const response = await resolve(event);

	return response;
};
