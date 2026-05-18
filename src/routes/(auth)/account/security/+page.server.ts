import { fail, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { otpSetupOtp, otpEnableOtp, otpDisableOtp, accountMe, accountEmailChangeRequest } from '$lib/api/client';
import { z } from 'zod';
import { extractErrorMessage } from '$lib/utils/errors';
import { emailChangeRequestSchema } from '$lib/schemas/auth';

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
		console.error('Failed to fetch user data:', error);
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
			console.log('[Server] Starting 2FA setup...');
			const response = await otpSetupOtp({
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			console.log('[Server] OTP setup response:', response);

			if (response.data) {
				console.log('[Server] Response data:', response.data);
				// Backend returns 'uri', not 'provisioning_uri'
				console.log('[Server] Provisioning URI:', response.data.uri);
				const result = {
					success: true,
					provisioningUri: response.data.uri
				};
				console.log('[Server] Returning:', result);
				return result;
			}

			if (response.error) {
				console.error('[Server] Error response:', response.error);
				const errorMessage = extractErrorMessage(response.error, '2FA is already enabled');
				return fail(400, {
					errors: { form: errorMessage }
				});
			}

			console.error('[Server] No data and no error in response');
			return fail(500, {
				errors: { form: 'Failed to setup 2FA' }
			});
		} catch (error) {
			console.error('[Server] 2FA setup error:', error);
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
			console.error('2FA verify error:', error);
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
			console.error('2FA disable error:', error);
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
			console.error('Email change request error:', error);
			return fail(500, {
				errors: { form: 'generic' },
				emailChange: { failed: true }
			});
		}
	}
};
