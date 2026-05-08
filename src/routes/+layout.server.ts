import type { LayoutServerLoad } from './$types';
import { env as publicEnv } from '$env/dynamic/public';

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
		},
		siteVerification: {
			google: publicEnv.PUBLIC_GOOGLE_SITE_VERIFICATION ?? '',
			bing: publicEnv.PUBLIC_BING_SITE_VERIFICATION ?? ''
		}
	};
};
