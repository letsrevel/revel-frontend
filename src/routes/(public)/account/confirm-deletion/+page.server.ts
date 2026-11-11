import * as m from '$lib/paraglide/messages.js';
import { fail, type Actions } from '@sveltejs/kit';
import { accountDeletionConfirmSchema } from '$lib/schemas/auth';
import { accountDeleteAccountConfirm } from '$lib/api/generated';
import { log } from '$lib/server/logger';
import { getApiFailure, isInvalidTokenDetail } from '$lib/server/api-result';
import { backendMessage } from '$lib/utils/api-error-detail';
import { resolveReturnTarget } from '$lib/server/tenant-canonical';

/** `code` of the backend's 409 asking the user to acknowledge forfeited referral payouts. */
const REFERRAL_FORFEITURE_CODE = 'referral_forfeiture_confirmation_required';

/** Parse the 409 forfeiture body, or null when it is some other 409. */
function parseForfeiture(body: unknown): {
	detail: string;
	count: number;
	total: string;
	failed: string;
	currency: string;
} | null {
	if (typeof body !== 'object' || body === null) return null;
	const b = body as Record<string, unknown>;
	if (b.code !== REFERRAL_FORFEITURE_CODE) return null;
	return {
		detail: typeof b.detail === 'string' ? b.detail : '',
		count: typeof b.unpaid_count === 'number' ? b.unpaid_count : 0,
		total: String(b.unpaid_total ?? ''),
		failed: String(b.failed_total ?? ''),
		currency: String(b.currency ?? '')
	};
}

export const actions: Actions = {
	confirmDeletion: async ({ request, cookies, fetch }) => {
		const formData = await request.formData();
		const token = formData.get('token') as string;
		// Set by the forfeiture panel after the user has seen what they would lose.
		const force = formData.get('force') === 'true';

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
					token: result.data.token,
					...(force ? { force: true } : {})
				},
				// event.fetch so handleFetch forwards the tenant Origin (#1070)
				fetch
			});

			// throwOnError is false: a 4xx/5xx is RETURNED, not thrown. Only a 2xx
			// may clear the session — otherwise the account still exists.
			const failure = getApiFailure(response);
			if (failure) {
				log.error('account_deletion_confirm_error', {
					status: failure.status,
					error: failure.body
				});

				// No response at all: never show the transport error text.
				if (failure.network) {
					return fail(500, {
						errors: { form: m['serverErrors.public.unexpectedErrorRetryLater']() }
					});
				}

				// Unpaid referral payouts would be forfeited. The token is NOT burned:
				// the page offers a confirm that re-submits it with force=true.
				if (failure.status === 409) {
					const forfeiture = parseForfeiture(failure.body);
					if (forfeiture) {
						return fail(409, { errors: {}, forfeiture });
					}
				}

				const detail = backendMessage(failure.body);

				// Expired/malformed ("Invalid token: <exception text>", never shown),
				// already-used (401) or unknown-user (404) token.
				if (
					failure.status === 401 ||
					failure.status === 404 ||
					(failure.status === 400 && isInvalidTokenDetail(detail))
				) {
					return fail(400, {
						errors: { form: m['serverErrors.public.deletionTokenInvalid']() }
					});
				}

				// 400: a refusal with its own message (expired token, owns organizations).
				if (failure.status === 400) {
					return fail(400, {
						errors: { form: detail ?? m['serverErrors.public.deleteAccountUnavailable']() }
					});
				}

				if (failure.status === 403) {
					return fail(403, {
						errors: { form: detail ?? m['serverErrors.public.deleteAccountUnavailable']() }
					});
				}

				// Generic error
				return fail(500, {
					errors: { form: m['serverErrors.public.unexpectedErrorRetryLater']() }
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
			// Unexpected throw (not a request failure, which is returned above).
			log.error('account_deletion_confirm_error', { error });
			return fail(500, {
				errors: {
					form: m['serverErrors.public.unexpectedErrorRetryLater']()
				}
			});
		}
	}
};
