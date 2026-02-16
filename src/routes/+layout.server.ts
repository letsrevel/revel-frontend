import type { LayoutServerLoad } from './$types';

/**
 * Root layout server load function
 * Passes access token from httpOnly cookie to client for auth initialization
 *
 * Token refresh is handled in hooks.server.ts (handleAuth) so that
 * locals.user is correctly populated before any load function runs.
 */
export const load: LayoutServerLoad = async ({ cookies }) => {
	const accessToken = cookies.get('access_token');
	const refreshToken = cookies.get('refresh_token');

	return {
		auth: {
			accessToken: accessToken || null,
			hasRefreshToken: !!refreshToken
		}
	};
};
