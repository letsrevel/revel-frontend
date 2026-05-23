import type { LayoutServerLoad } from './$types';
import { env as publicEnv } from '$env/dynamic/public';

/**
 * Root layout server load function
 *
 * SECURITY: Do NOT include the access token in this payload. Anything returned
 * here is serialized into the SSR HTML and is visible to anyone who views the
 * page source (and to any proxy/log that captures the response). The token is
 * already in an httpOnly cookie; the client populates its in-memory auth store
 * by calling `/api/auth/refresh` from the root layout on first paint, which
 * mints a fresh access token from the httpOnly refresh cookie. The trade-off
 * is one extra request per cold hydration in exchange for not leaking the
 * bearer token into the document.
 *
 * `hasAccessToken` is a non-sensitive boolean used by the layout to decide
 * whether to trigger that initial refresh. Token refresh is also handled in
 * hooks.server.ts (handleAuth) so that locals.user is populated before any
 * load function runs — that path uses the cookies directly and never reaches
 * the client.
 */
export const load: LayoutServerLoad = async ({ cookies }) => {
	const hasAccessToken = !!cookies.get('access_token');
	const hasRefreshToken = !!cookies.get('refresh_token');

	return {
		auth: {
			hasAccessToken,
			hasRefreshToken
		},
		siteVerification: {
			google: publicEnv.PUBLIC_GOOGLE_SITE_VERIFICATION ?? '',
			bing: publicEnv.PUBLIC_BING_SITE_VERIFICATION ?? ''
		}
	};
};
