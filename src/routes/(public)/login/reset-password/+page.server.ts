import * as m from '$lib/paraglide/messages.js';
import { fail, type Actions } from '@sveltejs/kit';
import { passwordResetSchema } from '$lib/schemas/auth';
import { accountResetPassword } from '$lib/api/generated';
import { log } from '$lib/server/logger';
import { getApiFailure, linkTokenFailureMessage } from '$lib/server/api-result';
import { backendMessage } from '$lib/utils/api-error-detail';
import { extractFieldErrors } from '$lib/utils/errors';
import { clearAuthCookies } from '$lib/server/auth-cookies';
import { resolveReturnTarget } from '$lib/server/tenant-canonical';

export const actions: Actions = {
	resetPassword: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const password = formData.get('password') as string;
		const confirmPassword = formData.get('confirmPassword') as string;
		const token = formData.get('token') as string;

		// Validate form data
		const result = passwordResetSchema.safeParse({
			password,
			confirmPassword,
			token
		});

		if (!result.success) {
			const errors: Record<string, string> = {};
			result.error.issues.forEach((error) => {
				if (error.path[0]) {
					errors[error.path[0].toString()] = error.message;
				}
			});

			return fail(400, {
				errors
			});
		}

		try {
			// Call backend API to reset password
			const response = await accountResetPassword({
				body: {
					password1: result.data.password,
					password2: result.data.confirmPassword,
					token: result.data.token
				},
				// event.fetch so handleFetch forwards the tenant Origin (#1070)
				fetch
			});

			// throwOnError is false: a 4xx/5xx is RETURNED, not thrown. Only a 2xx
			// may clear the session — otherwise nothing was reset.
			const failure = getApiFailure(response);
			if (failure) {
				log.error('password_reset_error', { status: failure.status, error: failure.body });

				// No response at all: never show the transport error text.
				if (failure.network) {
					return fail(500, {
						errors: { form: m['serverErrors.public.unexpectedErrorRetryLater']() }
					});
				}

				if (failure.status === 400) {
					// Password rejected by the backend's validators: `{ errors: { __all__: [...] } }`
					// (already localized via Accept-Language).
					const messages = extractFieldErrors(failure.body).flatMap((e) => e.messages);
					if (messages.length > 0) {
						return fail(400, { errors: { password: messages.join(' ') } });
					}

					// `{ detail, code }` (BE #1373): `invalid_token` / `token_expired`;
					// a code-less `{ detail }` shows the backend's own message.
					const { message, code } = linkTokenFailureMessage(failure.body, {
						invalid: m['serverErrors.public.resetTokenInvalid'](),
						expired: m['serverErrors.public.resetTokenExpired'](),
						fallback: m['serverErrors.public.resetPasswordUnavailable']()
					});
					// A dead link (invalid or expired) can only be fixed by a new one.
					return fail(400, { errors: { form: message }, offerNewLink: code !== undefined });
				}

				// Already-used (blacklisted, 401) or unknown-user (404) token.
				if (failure.status === 401 || failure.status === 404) {
					return fail(400, {
						errors: { form: m['serverErrors.public.resetTokenInvalid']() },
						offerNewLink: true
					});
				}

				// 403: the account is banned; the backend burned the token and says why.
				if (failure.status === 403) {
					return fail(403, {
						errors: {
							form:
								backendMessage(failure.body) ?? m['serverErrors.public.resetPasswordUnavailable']()
						}
					});
				}

				// Generic error
				return fail(500, {
					errors: { form: m['serverErrors.public.unexpectedErrorRetryLater']() }
				});
			}

			// The backend revoked every session of the account: drop this browser's
			// now-dead cookies so it is signed out and the success state's sign-in
			// link leads to a real login instead of a stale session.
			clearAuthCookies(cookies);

			// Started on a custom domain (#1070): the page offers a way back to its
			// login. Re-validated here; the form field is untrusted input.
			return {
				success: true,
				returnTo: await resolveReturnTarget(formData.get('return_host')?.toString(), fetch)
			};
		} catch (error) {
			// Unexpected throw (not a request failure, which is returned above).
			log.error('password_reset_error', { error });
			return fail(500, {
				errors: {
					form: m['serverErrors.public.unexpectedErrorRetryLater']()
				}
			});
		}
	}
};
