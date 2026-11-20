import type { Cookies } from '@sveltejs/kit';
import { getAuthCookieOptions, getClientCookieOptions } from '$lib/utils/cookies';
import { safeReturnUrl } from '$lib/utils/safe-redirect';
import {
	organizationClaimInvitation,
	eventpublicdiscoveryClaimInvitation
} from '$lib/api/generated/sdk.gen';

/**
 * Result of attempting to claim an invitation token
 */
export interface ClaimResult {
	type: 'organization' | 'event';
	success: boolean;
	name?: string;
	slug?: string;
	/** The claimed token id (event claims only). Server-side only: never put it in the flash cookie. */
	token?: string;
}

/**
 * Results from claiming all pending tokens
 */
export interface ClaimResults {
	organization?: ClaimResult;
	event?: ClaimResult;
}

/**
 * Cookie options for the claim flash cookie
 */
// 1 minute - just needs to survive the redirect; client JS reads it
const CLAIM_FLASH_COOKIE_OPTIONS = getClientCookieOptions(60);

/**
 * Attempt to claim pending invitation tokens after authentication.
 * Handles errors silently and gracefully - failures won't interrupt the auth flow.
 *
 * @param cookies - SvelteKit cookies object
 * @param accessToken - The user's access token
 * @param fetchFn - Fetch function to use for API calls
 * @returns ClaimResults with success/failure info and org/event names
 */
export async function claimPendingTokens(
	cookies: Cookies,
	accessToken: string,
	fetchFn: typeof fetch
): Promise<ClaimResults> {
	const results: ClaimResults = {};

	// Check for pending organization token
	const orgToken = cookies.get('pending_org_token');
	if (orgToken) {
		try {
			const response = await organizationClaimInvitation({
				path: { token: orgToken },
				headers: { Authorization: `Bearer ${accessToken}` },
				fetch: fetchFn
			});

			if (response.response?.ok && response.data) {
				results.organization = {
					type: 'organization',
					success: true,
					name: response.data.name,
					slug: response.data.slug
				};
			} else {
				console.warn('[TOKEN-CLAIM] Failed to claim organization token (may be expired/invalid)');
				results.organization = {
					type: 'organization',
					success: false
				};
			}
		} catch (error) {
			console.warn('[TOKEN-CLAIM] Error claiming organization token:', error);
			results.organization = {
				type: 'organization',
				success: false
			};
		}

		// Always delete the cookie to prevent retry loops
		cookies.delete('pending_org_token', getAuthCookieOptions());
	}

	// Check for pending event token
	const eventToken = cookies.get('pending_event_token');
	if (eventToken) {
		try {
			const response = await eventpublicdiscoveryClaimInvitation({
				path: { token: eventToken },
				headers: { Authorization: `Bearer ${accessToken}` },
				fetch: fetchFn
			});

			if (response.response?.ok && response.data) {
				results.event = {
					type: 'event',
					success: true,
					name: response.data.name,
					slug: response.data.slug,
					token: eventToken
				};
			} else {
				console.warn('[TOKEN-CLAIM] Failed to claim event token (may be expired/invalid)');
				results.event = {
					type: 'event',
					success: false
				};
			}
		} catch (error) {
			console.warn('[TOKEN-CLAIM] Error claiming event token:', error);
			results.event = {
				type: 'event',
				success: false
			};
		}

		// Always delete the cookie to prevent retry loops
		cookies.delete('pending_event_token', getAuthCookieOptions());
	}

	return results;
}

/**
 * Store claim results in a flash cookie for the client to read and display.
 * Only stores successful claims.
 *
 * @param cookies - SvelteKit cookies object
 * @param results - Results from claimPendingTokens
 */
export function setClaimFlashCookie(cookies: Cookies, results: ClaimResults): void {
	// Only set cookie if there are successful claims to report
	const successfulClaims: ClaimResult[] = [];

	if (results.organization?.success) {
		successfulClaims.push(results.organization);
	}
	if (results.event?.success) {
		// The token id stays on the server: the flash cookie is readable by client JS.
		const { token: _token, ...event } = results.event;
		successfulClaims.push(event);
	}

	if (successfulClaims.length > 0) {
		// Base64 encode the JSON to handle special characters safely in cookie value
		const jsonString = JSON.stringify(successfulClaims);
		const encodedValue = Buffer.from(jsonString).toString('base64');
		cookies.set('claim_flash', encodedValue, CLAIM_FLASH_COOKIE_OPTIONS);
	}
}

/**
 * Remove the claimed event token from a post-login redirect target.
 *
 * Login, OIDC and email verification return the user to a URL that can still
 * carry `?et=<token>`. When that token was just claimed, `hooks.server.ts`
 * would capture it again into the `pending_event_token` cookie, and the event
 * page would offer "Claim invitation" again instead of the real next step
 * (#1274). A token that was not claimed stays in the URL, so the user can
 * still claim it on the page.
 *
 * Only the query string changes; the path is kept byte for byte. Parsing the
 * target with `new URL()` would normalize dot segments and could turn a safe
 * path such as `/.//host` into the protocol-relative `//host`. The result goes
 * through `safeReturnUrl` again as a second guard.
 *
 * @param target - A same-origin path (already passed through safeReturnUrl)
 * @param results - Results from claimPendingTokens
 */
export function dropClaimedEventToken(target: string, results: ClaimResults): string {
	const claimed = results.event?.success ? results.event.token : undefined;
	if (!claimed) return target;

	const hashAt = target.indexOf('#');
	const beforeHash = hashAt === -1 ? target : target.slice(0, hashAt);
	const hash = hashAt === -1 ? '' : target.slice(hashAt);
	const queryAt = beforeHash.indexOf('?');
	if (queryAt === -1) return target;

	const pairs = beforeHash.slice(queryAt + 1).split('&');
	const kept = pairs.filter((pair) => !isQueryPair(pair, 'et', claimed));
	if (kept.length === pairs.length) return target;

	const query = kept.join('&');
	return safeReturnUrl(beforeHash.slice(0, queryAt) + (query ? `?${query}` : '') + hash);
}

function decodeQueryPart(part: string): string {
	try {
		return decodeURIComponent(part.replace(/\+/g, ' '));
	} catch {
		return part;
	}
}

function isQueryPair(pair: string, key: string, value: string): boolean {
	const eq = pair.indexOf('=');
	if (eq === -1) return false;
	return (
		decodeQueryPart(pair.slice(0, eq)) === key && decodeQueryPart(pair.slice(eq + 1)) === value
	);
}
