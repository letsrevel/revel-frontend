import { fail, redirect, isRedirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { registerSchema } from '$lib/schemas/auth';
import { accountRegister } from '$lib/api/generated/sdk.gen';
import { extractErrorMessage } from '$lib/utils/errors';
import { getDemoMode } from '$lib/server/features';
import { log } from '$lib/server/logger';
import { buildSeo } from '$lib/seo';
import { resolveLang } from '$lib/seo/server';

export const load: PageServerLoad = async ({ fetch, cookies, url, request }) => {
	// On demo backends the registration form is still reachable, but gated behind
	// a nudge overlay pushing the ready-made demo accounts (#600). Deciding this
	// server-side (getDemoMode is cached and fail-open) keeps the overlay in the
	// SSR render — no hydration-time swap. Non-demo backends see no overlay.
	const demo = await getDemoMode(fetch);

	const lang = resolveLang(request);
	const seo = buildSeo({ kind: 'auth', url, lang, page: 'register' });

	return {
		referralCodeFromCookie: cookies.get('referral_code') || '',
		demo,
		seo
	};
};

export const actions = {
	default: async ({ request, fetch }) => {
		const formData = await request.formData();
		const data = {
			email: formData.get('email') as string,
			password: formData.get('password') as string,
			confirmPassword: formData.get('confirmPassword') as string,
			acceptTerms: formData.get('acceptTerms') === 'on',
			referralCode:
				((formData.get('referralCode') as string) || '')
					.replace(/[^\p{L}\p{N}]/gu, '')
					.toUpperCase() || undefined
		};

		// Validate with Zod
		const validation = registerSchema.safeParse(data);
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
			// Call backend registration API
			const response = await accountRegister({
				body: {
					email: validation.data.email,
					password1: validation.data.password,
					password2: validation.data.confirmPassword,
					accept_toc_and_privacy: validation.data.acceptTerms,
					...(data.referralCode ? { referral_code: data.referralCode } : {})
				},
				fetch
			});

			log.debug('register_response_received', {
				response_ok: response.response?.ok,
				response_status: response.response?.status
			});

			// Check response status - API client returns { data } on success, { error } on failure
			// On successful 201 Created, response.response?.ok will be true
			if (response.response?.ok && response.data) {
				log.debug('register_redirecting_to_check_email');
				// Success - redirect to check-email page
				throw redirect(
					303,
					`/register/check-email?email=${encodeURIComponent(validation.data.email)}`
				);
			}

			// If response was not ok, handle the error
			if (!response.response?.ok && response.error) {
				log.warning('register_error_response', { status: response.response?.status });

				// Extract user-friendly error message from API error
				const errorMessage = extractErrorMessage(response.error, 'Registration failed');

				// Check if it's an email-specific error
				const apiError: unknown = response.error;
				if (
					typeof apiError === 'object' &&
					apiError !== null &&
					'email' in apiError &&
					apiError.email
				) {
					// Field-specific error
					const emailError = apiError.email;
					return fail(400, {
						errors: { email: Array.isArray(emailError) ? emailError[0] : emailError },
						email: data.email
					});
				}

				// Check for specific error patterns
				if (
					errorMessage.toLowerCase().includes('already') ||
					errorMessage.toLowerCase().includes('exist')
				) {
					return fail(400, {
						errors: { email: 'An account with this email already exists' },
						email: data.email
					});
				}

				// Generic error
				return fail(400, {
					errors: { form: errorMessage },
					email: data.email
				});
			}

			// Neither data nor error (shouldn't happen)
			return fail(500, {
				errors: { form: 'Invalid response from server' },
				email: data.email
			});
		} catch (error) {
			// Re-throw redirects immediately without logging
			if (isRedirect(error)) {
				throw error;
			}

			// Only log actual unexpected errors
			log.error('register_unexpected_error', { error });
			const errorMessage = extractErrorMessage(
				error,
				'An unexpected error occurred. Please try again.'
			);
			return fail(500, {
				errors: { form: errorMessage },
				email: data.email
			});
		}
	}
} satisfies Actions;
