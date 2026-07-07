import { fail, type Actions } from '@sveltejs/kit';
import { accountDeletionConfirmSchema } from '$lib/schemas/auth';
import { accountDeleteAccountConfirm } from '$lib/api/generated';
import { log } from '$lib/server/logger';

/** Read the HTTP status from an error shaped like `{ response: { status } }`. */
function getResponseStatus(error: unknown): unknown {
	if (
		typeof error === 'object' &&
		error !== null &&
		'response' in error &&
		typeof error.response === 'object' &&
		error.response !== null &&
		'status' in error.response
	) {
		return error.response.status;
	}
	return undefined;
}

/** Read the field-errors object from an error shaped like `{ response: { data: { errors } } }`. */
function getResponseErrors(error: unknown): object {
	if (
		typeof error === 'object' &&
		error !== null &&
		'response' in error &&
		typeof error.response === 'object' &&
		error.response !== null &&
		'data' in error.response &&
		typeof error.response.data === 'object' &&
		error.response.data !== null &&
		'errors' in error.response.data &&
		typeof error.response.data.errors === 'object' &&
		error.response.data.errors !== null
	) {
		return error.response.data.errors;
	}
	return {};
}

/** First element of a string array, if the value is one. */
function firstString(value: unknown): string | undefined {
	return Array.isArray(value) && typeof value[0] === 'string' ? value[0] : undefined;
}

export const actions: Actions = {
	confirmDeletion: async ({ request, cookies }) => {
		const formData = await request.formData();
		const token = formData.get('token') as string;

		// Validate form data
		const result = accountDeletionConfirmSchema.safeParse({ token });

		if (!result.success) {
			const errors: Record<string, string> = {};
			result.error.errors.forEach((error) => {
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
			await accountDeleteAccountConfirm({
				body: {
					token: result.data.token
				}
			});

			// Clear all authentication cookies
			cookies.delete('access_token', { path: '/' });
			cookies.delete('refresh_token', { path: '/' });
			cookies.delete('remember_me', { path: '/' });

			return {
				success: true
			};
		} catch (error) {
			log.error('account_deletion_confirm_error', { error });

			// Check for specific error types
			const status = getResponseStatus(error);
			if (status === 400) {
				const apiErrors = getResponseErrors(error);

				// Map backend errors
				const errors: Record<string, string> = {};

				if ('token' in apiErrors && apiErrors.token) {
					errors.form = 'Invalid or expired deletion token. Please request a new account deletion.';
				} else if ('non_field_errors' in apiErrors && apiErrors.non_field_errors) {
					errors.form = firstString(apiErrors.non_field_errors) || 'Account deletion failed';
				} else {
					errors.form = 'Unable to delete account. Please try again.';
				}

				return fail(400, { errors });
			}

			if (status === 403) {
				return fail(403, {
					errors: {
						form: 'You cannot delete your account while you own active organizations. Please transfer ownership or delete them first.'
					}
				});
			}

			// Generic error
			return fail(500, {
				errors: {
					form: 'An unexpected error occurred. Please try again later.'
				}
			});
		}
	}
};
