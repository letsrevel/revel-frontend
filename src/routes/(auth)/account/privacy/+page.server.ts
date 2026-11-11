import * as m from '$lib/paraglide/messages.js';
import { fail, type Actions } from '@sveltejs/kit';
import { accountDeleteAccountRequest, accountExportData } from '$lib/api/generated';
import { extractErrorMessage } from '$lib/utils/errors';
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

export const actions: Actions = {
	exportData: async ({ cookies }) => {
		const accessToken = cookies.get('access_token');

		if (!accessToken) {
			return fail(401, {
				errors: {
					exportForm: m['serverErrors.account.exportLoginRequired']()
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
		} catch (error) {
			log.error('data_export_request_failed', { error });

			// Check for rate limiting (429 Too Many Requests)
			if (getResponseStatus(error) === 429) {
				const errorMessage = extractErrorMessage(
					error,
					m['serverErrors.account.exportRateLimited']()
				);
				return fail(429, {
					errors: {
						exportForm: errorMessage
					}
				});
			}

			const errorMessage = extractErrorMessage(error, m['serverErrors.account.exportFailed']());
			return fail(500, {
				errors: {
					exportForm: errorMessage
				}
			});
		}
	},

	requestDeletion: async ({ cookies, fetch }) => {
		const accessToken = cookies.get('access_token');

		if (!accessToken) {
			return fail(401, {
				errors: {
					form: m['serverErrors.account.deleteLoginRequired']()
				}
			});
		}

		try {
			// Call backend API to send deletion confirmation email
			await accountDeleteAccountRequest({
				headers: {
					Authorization: `Bearer ${accessToken}`
				},
				// event.fetch so handleFetch forwards the tenant Origin (#1070)
				fetch
			});

			return {
				success: true
			};
		} catch (error) {
			log.error('account_deletion_request_failed', { error });

			// Check for specific error types
			const status = getResponseStatus(error);
			if (status === 400) {
				const errorMessage = extractErrorMessage(
					error,
					m['serverErrors.account.deleteBlockedByOrgs']()
				);
				return fail(400, { errors: { form: errorMessage } });
			}

			if (status === 403) {
				const errorMessage = extractErrorMessage(
					error,
					m['serverErrors.account.deleteForbiddenActiveOrgs']()
				);
				return fail(403, {
					errors: {
						form: errorMessage
					}
				});
			}

			// Generic error
			const errorMessage = extractErrorMessage(
				error,
				m['serverErrors.account.unexpectedErrorTryLater']()
			);
			return fail(500, {
				errors: {
					form: errorMessage
				}
			});
		}
	}
};
