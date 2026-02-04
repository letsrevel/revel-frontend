import type { Cookies } from '@sveltejs/kit';
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
const CLAIM_FLASH_COOKIE_OPTIONS = {
	path: '/',
	httpOnly: false, // Needs to be readable by client JS
	secure: process.env.NODE_ENV === 'production',
	sameSite: 'lax' as const,
	maxAge: 60 // 1 minute - just needs to survive the redirect
};

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
		console.log('[TOKEN-CLAIM] Attempting to claim organization token:', orgToken);
		try {
			const response = await organizationClaimInvitation({
				path: { token: orgToken },
				headers: { Authorization: `Bearer ${accessToken}` },
				fetch: fetchFn
			});

			if (response.response.ok && response.data) {
				console.log(
					'[TOKEN-CLAIM] Successfully claimed organization invitation:',
					response.data.name
				);
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
		cookies.delete('pending_org_token', { path: '/' });
	}

	// Check for pending event token
	const eventToken = cookies.get('pending_event_token');
	if (eventToken) {
		console.log('[TOKEN-CLAIM] Attempting to claim event token:', eventToken);
		try {
			const response = await eventpublicdiscoveryClaimInvitation({
				path: { token: eventToken },
				headers: { Authorization: `Bearer ${accessToken}` },
				fetch: fetchFn
			});

			if (response.response.ok && response.data) {
				console.log('[TOKEN-CLAIM] Successfully claimed event invitation:', response.data.name);
				results.event = {
					type: 'event',
					success: true,
					name: response.data.name,
					slug: response.data.slug
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
		cookies.delete('pending_event_token', { path: '/' });
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
		successfulClaims.push(results.event);
	}

	if (successfulClaims.length > 0) {
		// Base64 encode the JSON to handle special characters safely in cookie value
		const jsonString = JSON.stringify(successfulClaims);
		const encodedValue = Buffer.from(jsonString).toString('base64');
		cookies.set('claim_flash', encodedValue, CLAIM_FLASH_COOKIE_OPTIONS);
		console.log('[TOKEN-CLAIM] Set claim_flash cookie with', successfulClaims.length, 'claims');
	}
}
