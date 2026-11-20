import * as m from '$lib/paraglide/messages.js';
import { fail, redirect, isRedirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { loginSchema, otpSchema } from '$lib/schemas/auth';
import {
	accountResendVerificationEmail,
	authObtainToken,
	authObtainTokenWithOtp
} from '$lib/api/client';
import { extractErrorMessage } from '$lib/utils/errors';
import { classifyOtpFailure, totpLockedMessage } from '$lib/utils/totp-lock';
import { establishSession, sessionRememberMe } from '$lib/server/session';
import { getDemoMode, getSsoProviders } from '$lib/server/features';
import { log } from '$lib/server/logger';
import { buildSeo } from '$lib/seo';
import { resolveLang } from '$lib/seo/server';
import { registrationReturnUrl, safeReturnUrl } from '$lib/utils/safe-redirect';

/**
 * The backend refuses password login for an account whose email is not
 * verified yet: 403 with `code: "email_not_verified"`. Match on the code,
 * never on the translated `detail`.
 */
function isEmailNotVerified(response: Response | undefined, error: unknown): boolean {
	return (
		response?.status === 403 &&
		typeof error === 'object' &&
		error !== null &&
		'code' in error &&
		error.code === 'email_not_verified'
	);
}

/** A text form field; multipart `File` values (or a missing field) count as empty. */
function textField(formData: FormData, name: string): string {
	const value = formData.get(name);
	return typeof value === 'string' ? value : '';
}

export const load: PageServerLoad = async ({ url, request, fetch, locals }) => {
	const lang = resolveLang(request);
	const seo = buildSeo({ kind: 'auth', url, lang, page: 'login', tenant: locals.tenant });
	// SSR the correct login variant: on demo backends the page shows a
	// demo-account dropdown instead of the email/password form. Deciding this
	// client-side (appStore fetching /version after mount) visibly SWAPPED the
	// form and ate credentials typed in the window (#596).
	const demo = await getDemoMode(fetch);
	const ssoProviders = await getSsoProviders(fetch);
	return { seo, demo, ssoProviders };
};

export const actions = {
	// Standard email/password login
	login: async ({ request, fetch, cookies, url, locals }) => {
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
				await establishSession(
					cookies,
					{ access, refresh },
					sessionRememberMe(data.rememberMe, locals),
					fetch
				);

				// Redirect to returnUrl (same-origin only) or dashboard
				const returnUrl = safeReturnUrl(url.searchParams.get('returnUrl'));
				throw redirect(303, returnUrl);
			}

			if (isEmailNotVerified(response.response, response.error)) {
				return fail(403, { emailNotVerified: true, email: data.email });
			}

			// If we reach here, there was an error
			if (!response.response?.ok && response.error) {
				const errorMessage = extractErrorMessage(
					response.error,
					m['serverErrors.public.loginFailed']()
				);
				return fail(400, {
					errors: { form: errorMessage },
					email: data.email
				});
			}

			return fail(400, {
				errors: { form: m['serverErrors.public.invalidServerResponse']() },
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
				m['serverErrors.public.unexpectedErrorRetry']()
			);
			return fail(500, {
				errors: { form: errorMessage },
				email: data.email
			});
		}
	},

	// 2FA verification
	verify2FA: async ({ request, fetch, cookies, url, locals }) => {
		const formData = await request.formData();
		const data = {
			code: formData.get('code') as string,
			tempToken: formData.get('tempToken') as string,
			rememberMe: formData.get('rememberMe') === 'true',
			email: textField(formData, 'email')
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
			return fail(400, { errors, requires2FA: true, tempToken: data.tempToken, email: data.email });
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
				await establishSession(
					cookies,
					{ access, refresh },
					sessionRememberMe(data.rememberMe, locals),
					fetch
				);

				// Redirect to returnUrl (same-origin only) or dashboard
				const returnUrl = safeReturnUrl(url.searchParams.get('returnUrl'));
				throw redirect(303, returnUrl);
			}

			if (isEmailNotVerified(response.response, response.error)) {
				return fail(403, { emailNotVerified: true, email: data.email });
			}

			// The backend spends the temporary token on EVERY step-2 attempt, so a
			// retry with it is always refused (#1264). Wrong code (401) and the
			// per-account failure lock (429 totp_locked) both send the user back
			// to the password step with an explanation; the form is returned
			// WITHOUT requires2FA/tempToken so the spent token is never re-posted.
			const failure = classifyOtpFailure(response.response, response.error);
			if (failure === 'locked') {
				return fail(429, {
					errors: { form: totpLockedMessage(response.response) },
					restartedFrom2FA: true,
					email: data.email,
					rememberMe: data.rememberMe
				});
			}
			if (failure === 'throttled') {
				// Ordinary rate limit (rejected before the code was checked): the
				// token is intact, stay on the code step.
				return fail(429, {
					errors: { code: m['totpLock.rateLimited']() },
					requires2FA: true,
					tempToken: data.tempToken,
					email: data.email,
					rememberMe: data.rememberMe
				});
			}
			if (response.response?.status === 401) {
				return fail(401, {
					errors: { form: m['totpLock.wrongCodeRestart']() },
					restartedFrom2FA: true,
					email: data.email,
					rememberMe: data.rememberMe
				});
			}

			// If we reach here, there was an error
			if (!response.response?.ok && response.error) {
				const errorMessage = extractErrorMessage(
					response.error,
					m['serverErrors.public.invalidCodeRetry']()
				);
				return fail(400, {
					errors: { code: errorMessage },
					requires2FA: true,
					tempToken: data.tempToken,
					email: data.email
				});
			}

			return fail(400, {
				errors: { code: m['serverErrors.public.invalidServerResponse']() },
				requires2FA: true,
				tempToken: data.tempToken,
				email: data.email
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
				m['serverErrors.public.unexpectedErrorRetry']()
			);
			return fail(500, {
				errors: { code: errorMessage },
				requires2FA: true,
				tempToken: data.tempToken,
				email: data.email
			});
		}
	},

	// Re-send the verification email for an account that was refused login
	// because its email address is not verified yet. The backend always answers
	// 200 (it never reveals whether the address exists).
	resendVerification: async ({ request, fetch, url }) => {
		const formData = await request.formData();
		const email = textField(formData, 'email').trim();
		if (!email) {
			return fail(400, { emailNotVerified: true, email, resendError: true });
		}

		// Same stricter rule as registration: the backend answers 422 to a
		// return_url it dislikes, so anything doubtful is dropped.
		const returnUrl = registrationReturnUrl(url.searchParams.get('returnUrl'));

		try {
			const response = await accountResendVerificationEmail({
				body: { email, ...(returnUrl ? { return_url: returnUrl } : {}) },
				fetch
			});
			if (response.error || !response.response?.ok) {
				return fail(400, { emailNotVerified: true, email, resendError: true });
			}
			return { emailNotVerified: true, email, resendSent: true };
		} catch (error) {
			log.error('login_resend_verification_error', { error });
			return fail(500, { emailNotVerified: true, email, resendError: true });
		}
	}
} satisfies Actions;
