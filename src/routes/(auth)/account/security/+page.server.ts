import { fail, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	otpSetupOtp,
	otpEnableOtp,
	otpDisableOtp,
	accountMe,
	accountEmailChangeRequest
} from '$lib/api/client';
import { z } from 'zod';
import { extractErrorMessage } from '$lib/utils/errors';
import { emailChangeRequestSchema } from '$lib/schemas/auth';
import { log } from '$lib/server/logger';

/**
 * Load current user's 2FA status
 * Fetches fresh user data from the API to ensure totp_active is up-to-date
 */
export const load: PageServerLoad = async ({ cookies, depends }) => {
	depends('app:user');

	const accessToken = cookies.get('access_token');

	if (!accessToken) {
		return {
			totpActive: false,
			user: null
		};
	}

	try {
		const { data } = await accountMe({
			headers: {
				Authorization: `Bearer ${accessToken}`
			}
		});

		return {
			totpActive: data?.totp_active || false,
			user: data
		};
	} catch (error) {
		log.error('security_user_fetch_failed', { error });
		return {
			totpActive: false,
			user: null
		};
	}
};

/**
 * Form actions for 2FA management
 */
export const actions: Actions = {
	/**
	 * Get TOTP provisioning URI to set up 2FA
	 */
	setup: async ({ cookies }) => {
		const accessToken = cookies.get('access_token');

		if (!accessToken) {
			return fail(401, { errors: { form: 'Unauthorized' } });
		}

		try {
			log.debug('totp_setup_started');
			const response = await otpSetupOtp({
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			log.debug('totp_setup_response_received');

			if (response.data) {
				log.debug('totp_setup_succeeded');
				// Backend returns 'uri', not 'provisioning_uri'
				const result = {
					success: true,
					provisioningUri: response.data.uri
				};
				log.debug('totp_setup_result_ready');
				return result;
			}

			if (response.error) {
				log.warning('totp_setup_error_response');
				const errorMessage = extractErrorMessage(response.error, '2FA is already enabled');
				return fail(400, {
					errors: { form: errorMessage }
				});
			}

			log.error('totp_setup_empty_response');
			return fail(500, {
				errors: { form: 'Failed to setup 2FA' }
			});
		} catch (error) {
			log.error('totp_setup_failed', { error });
			const errorMessage = extractErrorMessage(error, 'An unexpected error occurred');
			return fail(500, {
				errors: { form: errorMessage }
			});
		}
	},

	/**
	 * Verify TOTP code and activate 2FA
	 */
	verify: async ({ request, cookies }) => {
		const accessToken = cookies.get('access_token');

		if (!accessToken) {
			return fail(401, { errors: { form: 'Unauthorized' } });
		}

		const formData = await request.formData();
		const code = formData.get('code') as string;

		// Validate code
		const codeSchema = z.string().length(6, 'Code must be 6 digits');
		const validation = codeSchema.safeParse(code);

		if (!validation.success) {
			return fail(400, {
				errors: { code: validation.error.errors[0].message }
			});
		}

		try {
			const response = await otpEnableOtp({
				body: {
					otp: validation.data
				},
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (response.data) {
				return {
					success: true,
					verified: true,
					message: '2FA has been successfully enabled!'
				};
			}

			if (response.error) {
				const errorMessage = extractErrorMessage(response.error, 'Invalid code. Please try again.');
				return fail(403, {
					errors: { code: errorMessage }
				});
			}

			return fail(500, {
				errors: { code: 'Failed to verify code' }
			});
		} catch (error) {
			log.error('totp_verify_failed', { error });
			const errorMessage = extractErrorMessage(error, 'An unexpected error occurred');
			return fail(500, {
				errors: { code: errorMessage }
			});
		}
	},

	/**
	 * Disable 2FA after verifying current TOTP code
	 */
	disable: async ({ request, cookies }) => {
		const accessToken = cookies.get('access_token');

		if (!accessToken) {
			return fail(401, { errors: { form: 'Unauthorized' } });
		}

		const formData = await request.formData();
		const code = formData.get('code') as string;

		// Validate code
		const codeSchema = z.string().length(6, 'Code must be 6 digits');
		const validation = codeSchema.safeParse(code);

		if (!validation.success) {
			return fail(400, {
				errors: { code: validation.error.errors[0].message }
			});
		}

		try {
			const response = await otpDisableOtp({
				body: {
					otp: validation.data
				},
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (response.data) {
				return {
					success: true,
					disabled: true,
					message: '2FA has been successfully disabled'
				};
			}

			if (response.error) {
				const errorMessage = extractErrorMessage(response.error, 'Invalid code. Please try again.');
				return fail(403, {
					errors: { code: errorMessage }
				});
			}

			return fail(500, {
				errors: { code: 'Failed to disable 2FA' }
			});
		} catch (error) {
			log.error('totp_disable_failed', { error });
			const errorMessage = extractErrorMessage(error, 'An unexpected error occurred');
			return fail(500, {
				errors: { code: errorMessage }
			});
		}
	},

	/**
	 * Request a self-served email change.
	 *
	 * Backend returns 200 with a ResponseMessage on success (and also on the
	 * silent globally-banned no-op — we treat that as success because the BE
	 * deliberately doesn't distinguish, to avoid signalling ban presence).
	 */
	requestEmailChange: async ({ request, cookies }) => {
		const accessToken = cookies.get('access_token');

		if (!accessToken) {
			return fail(401, { errors: { form: 'Unauthorized' } });
		}

		const formData = await request.formData();
		const validation = emailChangeRequestSchema.safeParse({
			new_email: formData.get('new_email'),
			password: formData.get('password')
		});

		if (!validation.success) {
			const errors: Record<string, string> = {};
			validation.error.errors.forEach((e) => {
				if (e.path[0]) errors[e.path[0].toString()] = e.message;
			});
			return fail(400, { errors });
		}

		try {
			const response = await accountEmailChangeRequest({
				body: {
					new_email: validation.data.new_email,
					password: validation.data.password
				},
				headers: {
					Authorization: `Bearer ${accessToken}`,
					'Accept-Language': 'en'
				}
			});

			if (response.response.ok) {
				return {
					success: true,
					emailChange: {
						new_email: validation.data.new_email
					}
				};
			}

			// Map backend 400 errors back to field-specific errors.
			const status = response.response.status;
			const message = extractErrorMessage(response.error, '');

			if (status === 429) {
				return fail(429, {
					errors: { form: 'throttled' },
					emailChange: { failed: true }
				});
			}

			if (status === 400) {
				const lower = message.toLowerCase();
				if (lower.includes('password')) {
					return fail(400, {
						errors: { password: 'wrongPassword' },
						emailChange: { failed: true }
					});
				}
				if (lower.includes('same')) {
					return fail(400, {
						errors: { new_email: 'sameEmail' },
						emailChange: { failed: true }
					});
				}
				if (lower.includes('already in use')) {
					return fail(400, {
						errors: { new_email: 'duplicate' },
						emailChange: { failed: true }
					});
				}
				return fail(400, {
					errors: { form: 'generic' },
					emailChange: { failed: true }
				});
			}

			return fail(500, {
				errors: { form: 'generic' },
				emailChange: { failed: true }
			});
		} catch (error) {
			log.error('email_change_request_failed', { error });
			return fail(500, {
				errors: { form: 'generic' },
				emailChange: { failed: true }
			});
		}
	}
};
