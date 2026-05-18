import { fail, type Actions } from '@sveltejs/kit';
import { accountEmailChangeConfirm } from '$lib/api/generated/sdk.gen';
import { emailChangeConfirmSchema } from '$lib/schemas/auth';
import { getAccessTokenCookieOptions, getRefreshTokenCookieOptions } from '$lib/utils/cookies';
import { extractErrorMessage } from '$lib/utils/errors';

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
				if (tokens?.access) {
					cookies.set('access_token', tokens.access, getAccessTokenCookieOptions());
				}
				if (tokens?.refresh) {
					cookies.set('refresh_token', tokens.refresh, getRefreshTokenCookieOptions());
				}

				const newEmail = response.data.user?.email ?? '';

				return {
					success: true,
					new_email: newEmail,
					user: response.data.user
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
			console.error('Email change confirm error:', error);
			return fail(500, { errors: { form: 'generic' } });
		}
	}
};
