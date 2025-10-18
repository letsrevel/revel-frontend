import type { LayoutServerLoad } from './$types';

/**
 * Root layout server load function
 * Passes access token from httpOnly cookie to client for auth initialization
 */
export const load: LayoutServerLoad = async ({ cookies, url }) => {
	const accessToken = cookies.get('access_token');
	const refreshToken = cookies.get('refresh_token');

	console.log('[LAYOUT.SERVER] Loading for path:', url.pathname, {
		hasAccessToken: !!accessToken,
		hasRefreshToken: !!refreshToken,
		accessTokenLength: accessToken?.length || 0
	});

	return {
		auth: {
			accessToken: accessToken || null,
			hasRefreshToken: !!refreshToken
		}
	};
};
