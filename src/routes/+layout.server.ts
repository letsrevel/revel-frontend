import type { LayoutServerLoad } from './$types';

/**
 * Root layout server load function
 * Passes access token from httpOnly cookie to client for auth initialization
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
