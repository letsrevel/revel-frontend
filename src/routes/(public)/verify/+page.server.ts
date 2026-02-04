import { redirect, isRedirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { accountVerifyEmail } from '$lib/api/generated/sdk.gen';
import { getAccessTokenCookieOptions, getRefreshTokenCookieOptions } from '$lib/utils/cookies';
import { extractErrorMessage } from '$lib/utils/errors';
import { claimPendingTokens, setClaimFlashCookie } from '$lib/server/token-claim';

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
				const claimResults = await claimPendingTokens(cookies, access, fetch);
				setClaimFlashCookie(cookies, claimResults);
			}

			// Redirect to profile page after successful verification so user can complete their profile
			console.log('[VERIFY] Redirecting to /account/profile');
			throw redirect(303, '/account/profile');
		}

		// If response was not ok, handle the error
		if (!response.response.ok && response.error) {
			const errorMessage = extractErrorMessage(response.error, 'Verification failed');
			return {
				success: false,
				error: errorMessage
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
		const errorMessage = extractErrorMessage(
			error,
			'An unexpected error occurred during verification'
		);
		return {
			success: false,
			error: errorMessage
		};
	}
};
