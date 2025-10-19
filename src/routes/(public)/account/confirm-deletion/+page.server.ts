import { fail, type Actions } from '@sveltejs/kit';
import { accountDeletionConfirmSchema } from '$lib/schemas/auth';
import { accountDeleteAccountConfirmDf87109A } from '$lib/api/generated';

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
			await accountDeleteAccountConfirmDf87109A({
				body: {
					token: result.data.token
				}
			});

			// Clear all authentication cookies
			cookies.delete('access_token', { path: '/' });
			cookies.delete('refresh_token', { path: '/' });

			return {
				success: true
			};
		} catch (error: any) {
			console.error('Account deletion confirmation error:', error);

			// Check for specific error types
			if (error?.response?.status === 400) {
				const apiErrors = error?.response?.data?.errors || {};

				// Map backend errors
				const errors: Record<string, string> = {};

				if (apiErrors.token) {
					errors.form = 'Invalid or expired deletion token. Please request a new account deletion.';
				} else if (apiErrors.non_field_errors) {
					errors.form = apiErrors.non_field_errors[0] || 'Account deletion failed';
				} else {
					errors.form = 'Unable to delete account. Please try again.';
				}

				return fail(400, { errors });
			}

			if (error?.response?.status === 403) {
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
