import * as m from '$lib/paraglide/messages.js';
import { fail, type Actions } from '@sveltejs/kit';
import { passwordResetSchema } from '$lib/schemas/auth';
import { accountResetPassword } from '$lib/api/generated';
import { log } from '$lib/server/logger';
import {
	firstString,
	getApiFailure,
	getDetailMessage,
	getFieldErrors
} from '$lib/server/api-result';
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
				}
			});

			// throwOnError is false: a 4xx/5xx is RETURNED, not thrown. Only a 2xx
			// may clear the session — otherwise nothing was reset.
			const failure = getApiFailure(response);
			if (failure) {
				log.error('password_reset_error', { status: failure.status, error: failure.body });

				if (failure.status === 400) {
					const apiErrors = getFieldErrors(failure.body);
					const password1 = 'password1' in apiErrors ? apiErrors.password1 : undefined;
					const password2 = 'password2' in apiErrors ? apiErrors.password2 : undefined;

					// Map backend errors to form errors
					const errors: Record<string, string> = {};

					if ('token' in apiErrors && apiErrors.token) {
						errors.form = m['serverErrors.public.resetTokenInvalid']();
					} else if (password1 || password2) {
						errors.password =
							firstString(password1) ||
							firstString(password2) ||
							m['serverErrors.public.passwordRequirementsNotMet']();
					} else if ('non_field_errors' in apiErrors && apiErrors.non_field_errors) {
						errors.form =
							firstString(apiErrors.non_field_errors) ||
							m['serverErrors.public.passwordResetFailed']();
					} else {
						errors.form =
							getDetailMessage(failure.body) ?? m['serverErrors.public.resetPasswordUnavailable']();
					}

					return fail(400, { errors });
				}

				// An expired, malformed or already-used token.
				if (failure.status === 401 || failure.status === 404) {
					return fail(400, {
						errors: {
							form: m['serverErrors.public.resetTokenInvalid']()
						}
					});
				}

				// Generic error
				return fail(500, {
					errors: {
						form: m['serverErrors.public.unexpectedErrorRetryLater']()
					}
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
			// Network failure: the request never produced a response.
			log.error('password_reset_error', { error });
			return fail(500, {
				errors: {
					form: m['serverErrors.public.unexpectedErrorRetryLater']()
				}
			});
		}
	}
};
