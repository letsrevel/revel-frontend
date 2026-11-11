import * as m from '$lib/paraglide/messages.js';
import { fail, type Actions } from '@sveltejs/kit';
import { accountDeleteAccountRequest, accountExportData } from '$lib/api/generated';
import { backendMessage } from '$lib/utils/api-error-detail';
import { log } from '$lib/server/logger';
import { getApiFailure } from '$lib/server/api-result';

export const actions: Actions = {
	exportData: async ({ cookies, fetch }) => {
		const accessToken = cookies.get('access_token');

		if (!accessToken) {
			return fail(401, {
				errors: {
					exportForm: m['serverErrors.account.exportLoginRequired']()
				}
			});
		}

		try {
			const result = await accountExportData({
				headers: {
					Authorization: `Bearer ${accessToken}`
				},
				// event.fetch so handleFetch forwards the tenant Origin (#1070)
				fetch
			});

			// throwOnError is false: a 4xx/5xx is RETURNED, not thrown.
			const failure = getApiFailure(result);
			if (failure) {
				log.error('data_export_request_failed', { status: failure.status, error: failure.body });

				// No response at all: never show the transport error text.
				if (failure.network) {
					return fail(500, {
						errors: { exportForm: m['serverErrors.account.exportFailed']() }
					});
				}

				// Rate limiting (429 Too Many Requests)
				if (failure.status === 429) {
					return fail(429, {
						errors: {
							exportForm:
								backendMessage(failure.body) ?? m['serverErrors.account.exportRateLimited']()
						}
					});
				}

				return fail(500, {
					errors: {
						exportForm: backendMessage(failure.body) ?? m['serverErrors.account.exportFailed']()
					}
				});
			}

			return {
				exportSuccess: true
			};
		} catch (error) {
			// Unexpected throw (not a request failure, which is returned above).
			log.error('data_export_request_failed', { error });
			return fail(500, {
				errors: {
					exportForm: m['serverErrors.account.exportFailed']()
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
			const result = await accountDeleteAccountRequest({
				headers: {
					Authorization: `Bearer ${accessToken}`
				},
				// event.fetch so handleFetch forwards the tenant Origin (#1070)
				fetch
			});

			// throwOnError is false: a 4xx/5xx is RETURNED, not thrown.
			const failure = getApiFailure(result);
			if (failure) {
				log.error('account_deletion_request_failed', {
					status: failure.status,
					error: failure.body
				});

				// No response at all: never show the transport error text.
				if (failure.network) {
					return fail(500, {
						errors: { form: m['serverErrors.account.unexpectedErrorTryLater']() }
					});
				}

				if (failure.status === 400) {
					return fail(400, {
						errors: {
							form: backendMessage(failure.body) ?? m['serverErrors.account.deleteBlockedByOrgs']()
						}
					});
				}

				if (failure.status === 403) {
					return fail(403, {
						errors: {
							form:
								backendMessage(failure.body) ??
								m['serverErrors.account.deleteForbiddenActiveOrgs']()
						}
					});
				}

				return fail(500, {
					errors: {
						form:
							backendMessage(failure.body) ?? m['serverErrors.account.unexpectedErrorTryLater']()
					}
				});
			}

			return {
				success: true
			};
		} catch (error) {
			// Unexpected throw (not a request failure, which is returned above).
			log.error('account_deletion_request_failed', { error });
			return fail(500, {
				errors: {
					form: m['serverErrors.account.unexpectedErrorTryLater']()
				}
			});
		}
	}
};
