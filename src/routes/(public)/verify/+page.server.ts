import { redirect, isRedirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Cookies } from '@sveltejs/kit';
import {
	accountVerifyEmail,
	organizationClaimInvitation,
	eventClaimInvitation
} from '$lib/api/generated/sdk.gen';
import {
	getAccessTokenCookieOptions,
	getRefreshTokenCookieOptions
} from '$lib/utils/cookies';

/**
 * Attempt to claim pending invitation tokens after email verification
 * Handles errors silently and gracefully
 */
async function claimPendingTokens(
	cookies: Cookies,
	accessToken: string,
	fetchFn: typeof fetch
): Promise<void> {
	// Check for pending organization token
	const orgToken = cookies.get('pending_org_token');
	if (orgToken) {
		console.log('[VERIFY] Attempting to claim organization token:', orgToken);
		try {
			const response = await organizationClaimInvitation({
				path: { token: orgToken },
				headers: { Authorization: `Bearer ${accessToken}` },
				fetch: fetchFn
			});

			if (response.response.ok && response.data) {
				console.log('[VERIFY] Successfully claimed organization invitation');
				// Clear the cookie after successful claim
				cookies.delete('pending_org_token', { path: '/' });
			} else {
				console.warn('[VERIFY] Failed to claim organization token (may be expired/invalid)');
				// Clear the cookie even on failure to prevent retry loops
				cookies.delete('pending_org_token', { path: '/' });
			}
		} catch (error) {
			console.warn('[VERIFY] Error claiming organization token:', error);
			// Clear the cookie on error to prevent retry loops
			cookies.delete('pending_org_token', { path: '/' });
		}
	}

	// Check for pending event token
	const eventToken = cookies.get('pending_event_token');
	if (eventToken) {
		console.log('[VERIFY] Attempting to claim event token:', eventToken);
		try {
			const response = await eventClaimInvitation({
				path: { token: eventToken },
				headers: { Authorization: `Bearer ${accessToken}` },
				fetch: fetchFn
			});

			if (response.response.ok && response.data) {
				console.log('[VERIFY] Successfully claimed event invitation');
				// Clear the cookie after successful claim
				cookies.delete('pending_event_token', { path: '/' });
			} else {
				console.warn('[VERIFY] Failed to claim event token (may be expired/invalid)');
				// Clear the cookie even on failure to prevent retry loops
				cookies.delete('pending_event_token', { path: '/' });
			}
		} catch (error) {
			console.warn('[VERIFY] Error claiming event token:', error);
			// Clear the cookie on error to prevent retry loops
			cookies.delete('pending_event_token', { path: '/' });
		}
	}
}

export const load: PageServerLoad = async ({ url, fetch, cookies }) => {
	const token = url.searchParams.get('token');

	if (!token) {
		return {
			success: false,
			error: 'Verification token is missing'
		};
	}

	try {
		console.log('[VERIFY] Starting verification for token');

		// Verify the email token
		const response = await accountVerifyEmail({
			body: { token },
			fetch
		});

		console.log('[VERIFY] Response received', {
			ok: response.response.ok,
			hasData: !!response.data
		});

		// Check response status - API client returns { data } on success, { error } on failure
		if (response.response.ok && response.data) {
			// Backend returns { user: {...}, token: { access: '...', refresh: '...' } }
			const tokens = response.data.token as { access: string; refresh: string };
			const { access, refresh } = tokens;

			console.log('[VERIFY] Success! Setting cookies', {
				hasAccess: !!access,
				hasRefresh: !!refresh
			});

			// Store tokens in httpOnly cookies
			if (access) {
				cookies.set('access_token', access, getAccessTokenCookieOptions());
				console.log('[VERIFY] Access token cookie set');
			}

			if (refresh) {
				cookies.set('refresh_token', refresh, getRefreshTokenCookieOptions());
				console.log('[VERIFY] Refresh token cookie set');
			}

			// Attempt to claim any pending invitation tokens
			// This is done silently - failures won't interrupt the verification flow
			if (access) {
				await claimPendingTokens(cookies, access, fetch);
			}

			// Redirect to profile page after successful verification so user can complete their profile
			console.log('[VERIFY] Redirecting to /account/profile');
			throw redirect(303, '/account/profile');
		}

		// If response was not ok, handle the error
		if (!response.response.ok && response.error) {
			const error = response.error as any;
			return {
				success: false,
				error: error?.detail || error?.message || 'Verification failed'
			};
		}

		// Neither data nor error (shouldn't happen)
		return {
			success: false,
			error: 'Invalid response from server'
		};
	} catch (error) {
		// Re-throw redirects immediately
		if (isRedirect(error)) {
			throw error;
		}

		// Log unexpected errors
		console.error('[VERIFY] Unexpected verification error:', error);
		return {
			success: false,
			error: 'An unexpected error occurred during verification'
		};
	}
};
