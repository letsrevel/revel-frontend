import { fail, type Actions } from '@sveltejs/kit';
import { accountEmailChangeConfirm } from '$lib/api/generated/sdk.gen';
import { emailChangeConfirmSchema } from '$lib/schemas/auth';
import { getAccessTokenCookieOptions, getRefreshTokenCookieOptions } from '$lib/utils/cookies';
import { extractErrorMessage } from '$lib/utils/errors';
import { log } from '$lib/server/logger';

export const actions: Actions = {
	confirmEmailChange: async ({ request, cookies, fetch }) => {
		const formData = await request.formData();
		const validation = emailChangeConfirmSchema.safeParse({
			token: formData.get('token')
		});

		if (!validation.success) {
			return fail(400, { errors: { form: 'invalid' } });
		}

		try {
			const response = await accountEmailChangeConfirm({
				body: { token: validation.data.token },
				headers: { 'Accept-Language': 'en' },
				fetch
			});

			if (response.response.ok && response.data) {
				const tokens = response.data.token as { access: string; refresh: string };
				// Honour the user's existing remember_me preference so a session-only
				// login doesn't get silently upgraded to a 30-day persistent cookie
				// after they confirm an email change. Defaults to false if absent.
				const rememberMe = cookies.get('remember_me') === 'true';
				if (tokens?.access) {
					cookies.set('access_token', tokens.access, getAccessTokenCookieOptions(rememberMe));
				}
				if (tokens?.refresh) {
					cookies.set('refresh_token', tokens.refresh, getRefreshTokenCookieOptions(rememberMe));
				}

				const newEmail = response.data.user?.email ?? '';

				return {
					success: true,
					new_email: newEmail,
					user: response.data.user,
					access_token: tokens?.access ?? null
				};
			}

			const status = response.response.status;
			const message = extractErrorMessage(response.error, '').toLowerCase();

			if (status === 429) {
				return fail(429, { errors: { form: 'throttled' } });
			}

			if (status === 400) {
				if (message.includes('already in use')) {
					return fail(400, { errors: { form: 'emailTaken' } });
				}
				return fail(400, { errors: { form: 'expired' } });
			}

			return fail(500, { errors: { form: 'generic' } });
		} catch (error) {
			log.error('email_change_confirm_error', { error });
			return fail(500, { errors: { form: 'generic' } });
		}
	}
};
