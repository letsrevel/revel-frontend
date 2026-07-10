import { fail, redirect, isRedirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { loginSchema, otpSchema } from '$lib/schemas/auth';
import { authObtainToken, authObtainTokenWithOtp } from '$lib/api/client';
import {
	getAccessTokenCookieOptions,
	getRefreshTokenCookieOptions,
	getRememberMeCookieOptions
} from '$lib/utils/cookies';
import { extractErrorMessage } from '$lib/utils/errors';
import { claimPendingTokens, setClaimFlashCookie } from '$lib/server/token-claim';
import { getDemoMode } from '$lib/server/features';
import { log } from '$lib/server/logger';
import { buildSeo } from '$lib/seo';
import { resolveLang } from '$lib/seo/server';
import { safeReturnUrl } from '$lib/utils/safe-redirect';

export const load: PageServerLoad = async ({ url, request, fetch }) => {
	const lang = resolveLang(request);
	const seo = buildSeo({ kind: 'auth', url, lang, page: 'login' });
	// SSR the correct login variant: on demo backends the page shows a
	// demo-account dropdown instead of the email/password form. Deciding this
	// client-side (appStore fetching /version after mount) visibly SWAPPED the
	// form and ate credentials typed in the window (#596).
	const demo = await getDemoMode(fetch);
	return { seo, demo };
};

export const actions = {
	// Standard email/password login
	login: async ({ request, fetch, cookies, url }) => {
		const formData = await request.formData();
		const data = {
			email: formData.get('email') as string,
			password: formData.get('password') as string,
			rememberMe: formData.get('rememberMe') === 'on'
		};

		// Validate with Zod
		const validation = loginSchema.safeParse(data);
		if (!validation.success) {
			const errors: Record<string, string> = {};
			validation.error.issues.forEach((err) => {
				if (err.path[0]) {
					errors[err.path[0].toString()] = err.message;
				}
			});
			return fail(400, { errors, email: data.email });
		}

		try {
			// Call backend login API
			const response = await authObtainToken({
				body: {
					username: validation.data.email,
					password: validation.data.password
				},
				fetch
			});

			// Check if 2FA is required (response has data with type='otp')
			if (response.data && 'type' in response.data && response.data.type === 'otp') {
				// 2FA required - return temp token for next step
				return {
					requires2FA: true,
					tempToken: response.data.token,
					email: data.email,
					rememberMe: data.rememberMe
				};
			}

			// Success - check if we have tokens
			if (response.response?.ok && response.data && 'access' in response.data) {
				const { access, refresh } = response.data;

				// Store access token (1 hour - matches backend ACCESS_TOKEN_LIFETIME)
				cookies.set('access_token', access, getAccessTokenCookieOptions(data.rememberMe));

				// Store refresh token
				// When rememberMe is true: cookie persists for 30 days
				// When rememberMe is false: session cookie (expires when browser closes)
				cookies.set('refresh_token', refresh, getRefreshTokenCookieOptions(data.rememberMe));

				// Store "remember me" preference for use during token refresh
				cookies.set(
					'remember_me',
					data.rememberMe ? 'true' : 'false',
					getRememberMeCookieOptions(data.rememberMe)
				);

				// Claim any pending invitation tokens (org/event)
				const claimResults = await claimPendingTokens(cookies, access, fetch);
				setClaimFlashCookie(cookies, claimResults);

				// Redirect to returnUrl (same-origin only) or dashboard
				const returnUrl = safeReturnUrl(url.searchParams.get('returnUrl'));
				throw redirect(303, returnUrl);
			}

			// If we reach here, there was an error
			if (!response.response?.ok && response.error) {
				const errorMessage = extractErrorMessage(response.error, 'Login failed');
				return fail(400, {
					errors: { form: errorMessage },
					email: data.email
				});
			}

			return fail(400, {
				errors: { form: 'Invalid response from server' },
				email: data.email
			});
		} catch (error) {
			// Re-throw redirects immediately without logging
			if (isRedirect(error)) {
				throw error;
			}

			// Only log actual unexpected errors
			log.error('login_unexpected_error', { error });
			const errorMessage = extractErrorMessage(
				error,
				'An unexpected error occurred. Please try again.'
			);
			return fail(500, {
				errors: { form: errorMessage },
				email: data.email
			});
		}
	},

	// 2FA verification
	verify2FA: async ({ request, fetch, cookies, url }) => {
		const formData = await request.formData();
		const data = {
			code: formData.get('code') as string,
			tempToken: formData.get('tempToken') as string,
			rememberMe: formData.get('rememberMe') === 'true'
		};

		// Validate OTP code
		const validation = otpSchema.safeParse({ code: data.code });
		if (!validation.success) {
			const errors: Record<string, string> = {};
			validation.error.issues.forEach((err) => {
				if (err.path[0]) {
					errors[err.path[0].toString()] = err.message;
				}
			});
			return fail(400, { errors, requires2FA: true, tempToken: data.tempToken });
		}

		try {
			// Verify OTP with backend
			const response = await authObtainTokenWithOtp({
				body: {
					token: data.tempToken,
					otp: validation.data.code
				},
				fetch
			});

			// Success - check if we have tokens
			if (response.response?.ok && response.data) {
				const { access, refresh } = response.data;

				// Store access token (1 hour - matches backend ACCESS_TOKEN_LIFETIME)
				cookies.set('access_token', access, getAccessTokenCookieOptions(data.rememberMe));

				// Store refresh token
				// When rememberMe is true: cookie persists for 30 days
				// When rememberMe is false: session cookie (expires when browser closes)
				cookies.set('refresh_token', refresh, getRefreshTokenCookieOptions(data.rememberMe));

				// Store "remember me" preference for use during token refresh
				cookies.set(
					'remember_me',
					data.rememberMe ? 'true' : 'false',
					getRememberMeCookieOptions(data.rememberMe)
				);

				// Claim any pending invitation tokens (org/event)
				const claimResults = await claimPendingTokens(cookies, access, fetch);
				setClaimFlashCookie(cookies, claimResults);

				// Redirect to returnUrl (same-origin only) or dashboard
				const returnUrl = safeReturnUrl(url.searchParams.get('returnUrl'));
				throw redirect(303, returnUrl);
			}

			// If we reach here, there was an error
			if (!response.response?.ok && response.error) {
				const errorMessage = extractErrorMessage(response.error, 'Invalid code. Please try again.');
				return fail(400, {
					errors: { code: errorMessage },
					requires2FA: true,
					tempToken: data.tempToken
				});
			}

			return fail(400, {
				errors: { code: 'Invalid response from server' },
				requires2FA: true,
				tempToken: data.tempToken
			});
		} catch (error) {
			// Re-throw redirects immediately without logging
			if (isRedirect(error)) {
				throw error;
			}

			// Only log actual unexpected errors
			log.error('login_2fa_unexpected_error', { error });
			const errorMessage = extractErrorMessage(
				error,
				'An unexpected error occurred. Please try again.'
			);
			return fail(500, {
				errors: { code: errorMessage },
				requires2FA: true,
				tempToken: data.tempToken
			});
		}
	}
} satisfies Actions;
