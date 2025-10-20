import { fail, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	otpSetupOtp,
	otpEnableOtp,
	otpDisableOtp,
	accountMe
} from '$lib/api/client';
import { z } from 'zod';

/**
 * Load current user's 2FA status
 * Fetches fresh user data from the API to ensure totp_active is up-to-date
 */
export const load: PageServerLoad = async ({ cookies, depends }) => {
	depends('app:user');

	const accessToken = cookies.get('access_token');

	if (!accessToken) {
		return {
			totpActive: false
		};
	}

	try {
		const { data } = await accountMe({
			headers: {
				Authorization: `Bearer ${accessToken}`
			}
		});

		return {
			totpActive: data?.totp_active || false
		};
	} catch (error) {
		console.error('Failed to fetch user data:', error);
		return {
			totpActive: false
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
				const error = response.error as any;
				console.error('[Server] Error response:', error);
				return fail(400, {
					errors: { form: error?.detail || '2FA is already enabled' }
				});
			}

			console.error('[Server] No data and no error in response');
			return fail(500, {
				errors: { form: 'Failed to setup 2FA' }
			});
		} catch (error) {
			console.error('[Server] 2FA setup error:', error);
			return fail(500, {
				errors: { form: 'An unexpected error occurred' }
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
				const error = response.error as any;
				return fail(403, {
					errors: { code: error?.detail || 'Invalid code. Please try again.' }
				});
			}

			return fail(500, {
				errors: { code: 'Failed to verify code' }
			});
		} catch (error) {
			console.error('2FA verify error:', error);
			return fail(500, {
				errors: { code: 'An unexpected error occurred' }
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
				const error = response.error as any;
				return fail(403, {
					errors: { code: error?.detail || 'Invalid code. Please try again.' }
				});
			}

			return fail(500, {
				errors: { code: 'Failed to disable 2FA' }
			});
		} catch (error) {
			console.error('2FA disable error:', error);
			return fail(500, {
				errors: { code: 'An unexpected error occurred' }
			});
		}
	}
};
