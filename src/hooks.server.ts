import type { Handle } from '@sveltejs/kit';

/**
 * Server-side hooks for authentication
 * Handles JWT refresh token management via httpOnly cookies
 */
export const handle: Handle = async ({ event, resolve }) => {
	// Get refresh token from cookie
	const refreshToken = event.cookies.get('refresh_token');

	// If refresh token exists, verify and set user context
	if (refreshToken) {
		try {
			// TODO: Verify refresh token and fetch user data
			// For now, we'll handle this client-side
			// In production, you'd want to validate the token server-side
			// and set event.locals.user

			// Example of what this would look like:
			// const user = await verifyRefreshToken(refreshToken);
			// event.locals.user = user;
		} catch (error) {
			// Invalid refresh token, clear it
			event.cookies.delete('refresh_token', { path: '/' });
		}
	}

	// Resolve the request
	const response = await resolve(event);

	return response;
};
