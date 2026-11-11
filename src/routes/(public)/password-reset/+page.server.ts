import * as m from '$lib/paraglide/messages.js';
import { fail, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { passwordResetRequestSchema } from '$lib/schemas/auth';
import { accountResetPasswordRequest } from '$lib/api/generated';
import { log } from '$lib/server/logger';
import { buildSeo } from '$lib/seo';
import { resolveLang } from '$lib/seo/server';

export const load: PageServerLoad = ({ url, request, locals }) => {
	const lang = resolveLang(request);
	const seo = buildSeo({ kind: 'auth', url, lang, page: 'password-reset', tenant: locals.tenant });
	return { seo };
};

export const actions: Actions = {
	resetRequest: async ({ request, fetch }) => {
		const formData = await request.formData();
		const email = formData.get('email') as string;

		// Validate form data
		const result = passwordResetRequestSchema.safeParse({ email });

		if (!result.success) {
			const errors: Record<string, string> = {};
			result.error.issues.forEach((error) => {
				if (error.path[0]) {
					errors[error.path[0].toString()] = error.message;
				}
			});

			return fail(400, {
				errors,
				email
			});
		}

		try {
			// Call backend API to send password reset email
			const response = await accountResetPasswordRequest({
				body: {
					email: result.data.email
				},
				// event.fetch so handleFetch forwards the tenant Origin (#1070)
				fetch
			});

			// throwOnError is false: failures are RETURNED. The outcome is hidden on
			// purpose (user enumeration) with one exception: a 429 throttle says
			// nothing about the account, so the user is told to wait.
			if (response.response?.status === 429) {
				log.error('password_reset_request_throttled', {});
				return fail(429, {
					errors: { form: m['serverErrors.public.resetRequestRateLimited']() },
					email: result.data.email
				});
			}

			// Always return success to prevent user enumeration
			// The backend will only send an email if the account exists
			return {
				success: true,
				email: result.data.email
			};
		} catch (error) {
			log.error('password_reset_request_error', { error });

			// Even on error, return success to prevent user enumeration
			// The user will see the success message and check their email
			return {
				success: true,
				email: result.data.email
			};
		}
	}
};
