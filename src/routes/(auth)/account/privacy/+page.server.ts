import { fail, type Actions } from '@sveltejs/kit';
import { accountDeleteAccountRequestCd42D2B8 } from '$lib/api/generated';

export const actions: Actions = {
	requestDeletion: async ({ locals }) => {
		const user = locals.user;

		if (!user) {
			return fail(401, {
				errors: {
					form: 'You must be logged in to delete your account'
				}
			});
		}

		try {
			// Call backend API to send deletion confirmation email
			await accountDeleteAccountRequestCd42D2B8({
				headers: {
					Authorization: `Bearer ${user.accessToken}`
				}
			});

			return {
				success: true
			};
		} catch (error: any) {
			console.error('Account deletion request error:', error);

			// Check for specific error types
			if (error?.response?.status === 400) {
				const apiErrors = error?.response?.data?.errors || {};

				// Map backend errors
				const errors: Record<string, string> = {};

				if (apiErrors.non_field_errors) {
					errors.form = apiErrors.non_field_errors[0];
				} else if (error?.response?.data?.message) {
					errors.form = error.response.data.message;
				} else {
					errors.form =
						'Cannot delete account. You may own organizations that need to be transferred first.';
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
