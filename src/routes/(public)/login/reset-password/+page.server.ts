import { fail, type Actions } from '@sveltejs/kit';
import { passwordResetSchema } from '$lib/schemas/auth';
import { accountResetPassword } from '$lib/api/generated';

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
		} catch (error: any) {
			console.error('Password reset error:', error);

			// Check for specific error types
			if (error?.response?.status === 400) {
				const apiErrors = error?.response?.data?.errors || {};

				// Map backend errors to form errors
				const errors: Record<string, string> = {};

				if (apiErrors.token) {
					errors.form = 'Invalid or expired reset token. Please request a new password reset.';
				} else if (apiErrors.password1 || apiErrors.password2) {
					errors.password =
						apiErrors.password1?.[0] ||
						apiErrors.password2?.[0] ||
						'Password does not meet requirements';
				} else if (apiErrors.non_field_errors) {
					errors.form = apiErrors.non_field_errors[0] || 'Password reset failed';
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
