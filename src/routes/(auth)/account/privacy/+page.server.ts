import { fail, type Actions } from '@sveltejs/kit';
import { accountDeleteAccountRequest, accountExportData } from '$lib/api/generated';
import { extractErrorMessage } from '$lib/utils/errors';

export const actions: Actions = {
	exportData: async ({ cookies }) => {
		const accessToken = cookies.get('access_token');

		if (!accessToken) {
			return fail(401, {
				errors: {
					exportForm: 'You must be logged in to export your data'
				}
			});
		}

		try {
			await accountExportData({
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			return {
				exportSuccess: true
			};
		} catch (error: any) {
			console.error('Data export request error:', error);

			// Check for rate limiting (429 Too Many Requests)
			if (error?.response?.status === 429) {
				const errorMessage = extractErrorMessage(
					error,
					'You can only request a data export once every 24 hours. Please try again later.'
				);
				return fail(429, {
					errors: {
						exportForm: errorMessage
					}
				});
			}

			const errorMessage = extractErrorMessage(error, 'Failed to request data export. Please try again.');
			return fail(500, {
				errors: {
					exportForm: errorMessage
				}
			});
		}
	},

	requestDeletion: async ({ cookies }) => {
		const accessToken = cookies.get('access_token');

		if (!accessToken) {
			return fail(401, {
				errors: {
					form: 'You must be logged in to delete your account'
				}
			});
		}

		try {
			// Call backend API to send deletion confirmation email
			await accountDeleteAccountRequest({
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			return {
				success: true
			};
		} catch (error: any) {
			console.error('Account deletion request error:', error);

			// Check for specific error types
			if (error?.response?.status === 400) {
				const errorMessage = extractErrorMessage(
					error,
					'Cannot delete account. You may own organizations that need to be transferred first.'
				);
				return fail(400, { errors: { form: errorMessage } });
			}

			if (error?.response?.status === 403) {
				const errorMessage = extractErrorMessage(
					error,
					'You cannot delete your account while you own active organizations. Please transfer ownership or delete them first.'
				);
				return fail(403, {
					errors: {
						form: errorMessage
					}
				});
			}

			// Generic error
			const errorMessage = extractErrorMessage(error, 'An unexpected error occurred. Please try again later.');
			return fail(500, {
				errors: {
					form: errorMessage
				}
			});
		}
	}
};
