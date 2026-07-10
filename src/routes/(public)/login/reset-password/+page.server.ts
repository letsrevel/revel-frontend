import { fail, type Actions } from '@sveltejs/kit';
import { passwordResetSchema } from '$lib/schemas/auth';
import { accountResetPassword } from '$lib/api/generated';
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
	resetPassword: async ({ request }) => {
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
			await accountResetPassword({
				body: {
					password1: result.data.password,
					password2: result.data.confirmPassword,
					token: result.data.token
				}
			});

			return {
				success: true
			};
		} catch (error) {
			log.error('password_reset_error', { error });

			// Check for specific error types
			if (getResponseStatus(error) === 400) {
				const apiErrors = getResponseErrors(error);
				const password1 = 'password1' in apiErrors ? apiErrors.password1 : undefined;
				const password2 = 'password2' in apiErrors ? apiErrors.password2 : undefined;

				// Map backend errors to form errors
				const errors: Record<string, string> = {};

				if ('token' in apiErrors && apiErrors.token) {
					errors.form = 'Invalid or expired reset token. Please request a new password reset.';
				} else if (password1 || password2) {
					errors.password =
						firstString(password1) ||
						firstString(password2) ||
						'Password does not meet requirements';
				} else if ('non_field_errors' in apiErrors && apiErrors.non_field_errors) {
					errors.form = firstString(apiErrors.non_field_errors) || 'Password reset failed';
				} else {
					errors.form = 'Unable to reset password. Please try again.';
				}

				return fail(400, { errors });
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
