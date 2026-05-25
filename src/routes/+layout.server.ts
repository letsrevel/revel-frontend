import { createHash } from 'node:crypto';
import type { LayoutServerLoad } from './$types';
import { env as publicEnv } from '$env/dynamic/public';
import { getImpersonationInfo } from '$lib/utils/impersonation';

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
 *
 * `fingerprint` is a non-sensitive, stable-per-identity hash (user id +
 * impersonation markers, NOT the rotating token). The layout compares it
 * across loads to detect a server-side session SWAP — starting/stopping
 * impersonation, or logging in as a different user — where `hasAccessToken`
 * stays `true` but the identity changed, and re-bootstraps the in-memory store
 * for the new identity. `impersonated` tells the layout to bootstrap via
 * `/api/auth/session-token` instead of `/api/auth/refresh` (impersonation
 * sessions have no refresh cookie).
 */
export const load: LayoutServerLoad = async ({ cookies, locals }) => {
	const accessToken = cookies.get('access_token');
	const hasAccessToken = !!accessToken;
	const hasRefreshToken = !!cookies.get('refresh_token');

	let fingerprint: string | null = null;
	let impersonated = false;
	if (accessToken && locals.user) {
		const imp = getImpersonationInfo(accessToken);
		impersonated = imp.isImpersonated;
		// Hash the identity markers so we never expose raw ids in the SSR HTML.
		// Stable across token rotation (same user) → no re-bootstrap on refresh;
		// changes on any identity/impersonation change → re-bootstrap.
		fingerprint = createHash('sha256')
			.update(
				`${locals.user.id ?? ''}:${imp.isImpersonated ? '1' : '0'}:${imp.impersonatedById ?? ''}`
			)
			.digest('hex')
			.slice(0, 16);
	}

	return {
		auth: {
			hasAccessToken,
			hasRefreshToken,
			fingerprint,
			impersonated
		},
		siteVerification: {
			google: publicEnv.PUBLIC_GOOGLE_SITE_VERIFICATION ?? '',
			bing: publicEnv.PUBLIC_BING_SITE_VERIFICATION ?? ''
		}
	};
};
