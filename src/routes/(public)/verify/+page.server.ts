import { redirect, isRedirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { accountVerifyEmail } from '$lib/api/generated/sdk.gen';
import { getAccessTokenCookieOptions, getRefreshTokenCookieOptions } from '$lib/utils/cookies';
import { extractErrorMessage } from '$lib/utils/errors';
import { claimPendingTokens, setClaimFlashCookie } from '$lib/server/token-claim';
import { log } from '$lib/server/logger';
import { buildSeo } from '$lib/seo';
import { resolveLang } from '$lib/seo/server';

export const load: PageServerLoad = async ({ url, request, fetch, cookies }) => {
	const lang = resolveLang(request);
	const seo = buildSeo({ kind: 'auth', url, lang, page: 'verify' });
	const token = url.searchParams.get('token');

	if (!token) {
		return {
			seo,
			success: false,
			error: 'Verification token is missing'
		};
	}

	try {
		log.debug('verify_started');

		// Verify the email token
		const response = await accountVerifyEmail({
			body: { token },
			fetch
		});

		log.debug('verify_response_received', { ok: response.response?.ok });

		// Check response status - API client returns { data } on success, { error } on failure
		if (response.response?.ok && response.data) {
			// Backend returns { user: {...}, token: { access: '...', refresh: '...' } }
			const tokens = response.data.token as { access: string; refresh: string };
			const { access, refresh } = tokens;

			log.debug('verify_setting_cookies');

			// Store tokens in httpOnly cookies
			if (access) {
				cookies.set('access_token', access, getAccessTokenCookieOptions());
			}

			if (refresh) {
				cookies.set('refresh_token', refresh, getRefreshTokenCookieOptions());
			}

			// Attempt to claim any pending invitation tokens
			// This is done silently - failures won't interrupt the verification flow
			if (access) {
				const claimResults = await claimPendingTokens(cookies, access, fetch);
				setClaimFlashCookie(cookies, claimResults);
			}

			// Redirect to profile page after successful verification so user can complete their profile
			throw redirect(303, '/account/profile');
		}

		// If response was not ok, handle the error
		if (!response.response?.ok && response.error) {
			const errorMessage = extractErrorMessage(response.error, 'Verification failed');
			return {
				seo,
				success: false,
				error: errorMessage
			};
		}

		// Neither data nor error (shouldn't happen)
		return {
			seo,
			success: false,
			error: 'Invalid response from server'
		};
	} catch (error) {
		// Re-throw redirects immediately
		if (isRedirect(error)) {
			throw error;
		}

		// Log unexpected errors
		log.error('verify_unexpected_error', { error });
		const errorMessage = extractErrorMessage(
			error,
			'An unexpected error occurred during verification'
		);
		return {
			seo,
			success: false,
			error: errorMessage
		};
	}
};
