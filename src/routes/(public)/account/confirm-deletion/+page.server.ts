import * as m from '$lib/paraglide/messages.js';
import { fail, type Actions } from '@sveltejs/kit';
import { accountDeletionConfirmSchema } from '$lib/schemas/auth';
import { accountDeleteAccountConfirm } from '$lib/api/generated';
import { log } from '$lib/server/logger';
import {
	firstString,
	getApiFailure,
	getDetailMessage,
	getFieldErrors
} from '$lib/server/api-result';
import { resolveReturnTarget } from '$lib/server/tenant-canonical';

export const actions: Actions = {
	confirmDeletion: async ({ request, cookies, fetch }) => {
		const formData = await request.formData();
		const token = formData.get('token') as string;

		// Validate form data
		const result = accountDeletionConfirmSchema.safeParse({ token });

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
			// Call backend API to confirm account deletion
			const response = await accountDeleteAccountConfirm({
				body: {
					token: result.data.token
				}
			});

			// throwOnError is false: a 4xx/5xx is RETURNED, not thrown. Only a 2xx
			// may clear the session — otherwise the account still exists.
			const failure = getApiFailure(response);
			if (failure) {
				log.error('account_deletion_confirm_error', {
					status: failure.status,
					error: failure.body
				});

				if (failure.status === 400) {
					const apiErrors = getFieldErrors(failure.body);

					// Map backend errors
					const errors: Record<string, string> = {};

					if ('token' in apiErrors && apiErrors.token) {
						errors.form = m['serverErrors.public.deletionTokenInvalid']();
					} else if ('non_field_errors' in apiErrors && apiErrors.non_field_errors) {
						errors.form =
							firstString(apiErrors.non_field_errors) ||
							m['serverErrors.public.accountDeletionFailed']();
					} else {
						errors.form =
							getDetailMessage(failure.body) ?? m['serverErrors.public.deleteAccountUnavailable']();
					}

					return fail(400, { errors });
				}

				// An expired, malformed or already-used token.
				if (failure.status === 401 || failure.status === 404) {
					return fail(400, {
						errors: {
							form: m['serverErrors.public.deletionTokenInvalid']()
						}
					});
				}

				if (failure.status === 403) {
					return fail(403, {
						errors: {
							form: m['serverErrors.public.cannotDeleteOwnsOrgs']()
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

			// Clear all authentication cookies
			cookies.delete('access_token', { path: '/' });
			cookies.delete('refresh_token', { path: '/' });
			cookies.delete('remember_me', { path: '/' });

			// Started on a custom domain (#1070): offer the way back to its root
			// (the account is gone, so no login/dashboard). Re-validated here.
			return {
				success: true,
				returnTo: await resolveReturnTarget(formData.get('return_host')?.toString(), fetch)
			};
		} catch (error) {
			// Network failure: the request never produced a response.
			log.error('account_deletion_confirm_error', { error });
			return fail(500, {
				errors: {
					form: m['serverErrors.public.unexpectedErrorRetryLater']()
				}
			});
		}
	}
};
