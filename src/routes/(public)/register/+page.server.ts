import { fail, redirect, isRedirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { registerSchema } from '$lib/schemas/auth';
import { accountRegister, referralGetInvitation } from '$lib/api/generated/sdk.gen';
import { isReferralInviteId } from '$lib/schemas/referral';
import { extractErrorMessage } from '$lib/utils/errors';
import { getDemoMode, getSsoProviders } from '$lib/server/features';
import { log } from '$lib/server/logger';
import { buildSeo } from '$lib/seo';
import { resolveLang } from '$lib/seo/server';

export const load: PageServerLoad = async ({ fetch, cookies, url, request }) => {
	// On demo backends the registration form is still reachable, but gated behind
	// a nudge overlay pushing the ready-made demo accounts (#600). Deciding this
	// server-side (getDemoMode is cached and fail-open) keeps the overlay in the
	// SSR render — no hydration-time swap. Non-demo backends see no overlay.
	const demo = await getDemoMode(fetch);
	const ssoProviders = await getSsoProviders(fetch);

	const lang = resolveLang(request);
	const seo = buildSeo({ kind: 'auth', url, lang, page: 'register' });

	return {
		referralCodeFromCookie: cookies.get('referral_code') || '',
		referralInvite: await loadReferralInvite(fetch, url),
		demo,
		ssoProviders,
		seo
	};
};

/**
 * `?referral_invite=<application_id>` — an approved referral-program invite
 * that has not been used yet (FE #938, BE #987).
 *
 * Prefill ONLY. The invite id is never sent on registration: the backend
 * enrolls by matching the verified email, which is why the email the endpoint
 * returns is the one the form locks to. Anything that does not resolve to a
 * live invite (typo, already-used id, expired flag, backend down) degrades
 * SILENTLY to the ordinary registration form — a visitor who followed a stale
 * link must still be able to sign up.
 */
async function loadReferralInvite(
	fetch: typeof globalThis.fetch,
	url: URL
): Promise<{ email: string; code: string } | null> {
	const inviteId = url.searchParams.get('referral_invite');
	if (!isReferralInviteId(inviteId)) {
		return null;
	}
	try {
		const response = await referralGetInvitation({
			path: { application_id: inviteId },
			fetch
		});
		if (response.response?.status !== 200 || !response.data?.email) {
			return null;
		}
		return { email: response.data.email, code: response.data.code };
	} catch {
		return null;
	}
}

export const actions = {
	default: async ({ request, fetch, url }) => {
		const formData = await request.formData();
		/*
		 * The invite's email wins over whatever was posted, re-resolved from the
		 * SAME query string the form was rendered with (the form has no `action`,
		 * so `?referral_invite=` is still here). The page's `readonly` field and
		 * its two client-side guards are UX: `readonly` stops keystrokes but not
		 * scripts, and neither guard exists at all with JavaScript off or on a
		 * hand-rolled POST. Deciding it here is what actually makes the lock a
		 * lock. An invite that no longer resolves — consumed, flag switched off,
		 * backend down — yields null and registration proceeds normally with the
		 * submitted address rather than being blocked.
		 */
		const invite = await loadReferralInvite(fetch, url);
		const data = {
			email: invite?.email ?? (formData.get('email') as string),
			password: formData.get('password') as string,
			confirmPassword: formData.get('confirmPassword') as string,
			acceptTerms: formData.get('acceptTerms') === 'on',
			// Trim only. Referral codes are matched case-INSENSITIVELY and stored
			// as typed (BE #987), and `-`/`_` are legal characters — the old
			// strip-and-uppercase turned a valid `test-partner` into
			// `TESTPARTNER`, which matches nothing. The backend validates the
			// rest; sending the code through untouched keeps this one normalizer
			// from being the thing that breaks referral attribution.
			referralCode: ((formData.get('referralCode') as string) || '').trim() || undefined
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
