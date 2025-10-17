import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { loginSchema, otpSchema } from '$lib/schemas/auth';
import {
	authObtainToken88D8C7F5,
	authObtainTokenWithOtpCa173D18
} from '$lib/api/client';

export const actions = {
	// Standard email/password login
	login: async ({ request, fetch, cookies, url }) => {
		const formData = await request.formData();
		const data = {
			email: formData.get('email') as string,
			password: formData.get('password') as string,
			rememberMe: formData.get('rememberMe') === 'on'
		};

		// Validate with Zod
		const validation = loginSchema.safeParse(data);
		if (!validation.success) {
			const errors: Record<string, string> = {};
			validation.error.errors.forEach((err) => {
				if (err.path[0]) {
					errors[err.path[0].toString()] = err.message;
				}
			});
			return fail(400, { errors, email: data.email });
		}

		try {
			// Call backend login API
			const response = await authObtainToken88D8C7F5({
				body: {
					username: validation.data.email,
					password: validation.data.password
				},
				fetch
			});

			if (response.error) {
				// Check if 2FA is required
				if (response.data && 'type' in response.data && response.data.type === 'otp') {
					// Return temp token for 2FA step
					return {
						requires2FA: true,
						tempToken: response.data.token,
						email: data.email,
						rememberMe: data.rememberMe
					};
				}

				// Handle other errors - 4xx errors have { detail: string } body
				const error = response.error as any;
				const errorMessage = error?.detail || error?.message || 'Login failed';
				return fail(400, {
					errors: { form: errorMessage },
					email: data.email
				});
			}

			// Success - store tokens and redirect
			if (response.data && 'access' in response.data) {
				const { access, refresh } = response.data;

				// Store access token (15 minutes)
				cookies.set('access_token', access, {
					path: '/',
					httpOnly: true,
					secure: true,
					sameSite: 'lax',
					maxAge: 60 * 15
				});

				// Store refresh token (7 days default, longer if remember me)
				const refreshMaxAge = data.rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24 * 7;
				cookies.set('refresh_token', refresh, {
					path: '/',
					httpOnly: true,
					secure: true,
					sameSite: 'lax',
					maxAge: refreshMaxAge
				});

				// Redirect to returnUrl or dashboard
				const returnUrl = url.searchParams.get('returnUrl') || '/dashboard';
				throw redirect(303, returnUrl);
			}

			return fail(400, {
				errors: { form: 'Invalid response from server' },
				email: data.email
			});
		} catch (error) {
			if (error instanceof Response) {
				throw error; // Re-throw redirect
			}

			return fail(500, {
				errors: { form: 'An unexpected error occurred. Please try again.' },
				email: data.email
			});
		}
	},

	// 2FA verification
	verify2FA: async ({ request, fetch, cookies, url }) => {
		const formData = await request.formData();
		const data = {
			code: formData.get('code') as string,
			tempToken: formData.get('tempToken') as string,
			rememberMe: formData.get('rememberMe') === 'true'
		};

		// Validate OTP code
		const validation = otpSchema.safeParse({ code: data.code });
		if (!validation.success) {
			const errors: Record<string, string> = {};
			validation.error.errors.forEach((err) => {
				if (err.path[0]) {
					errors[err.path[0].toString()] = err.message;
				}
			});
			return fail(400, { errors, requires2FA: true, tempToken: data.tempToken });
		}

		try {
			// Verify OTP with backend
			const response = await authObtainTokenWithOtpCa173D18({
				body: {
					token: data.tempToken,
					otp: validation.data.code
				},
				fetch
			});

			if (response.error) {
				const error = response.error as any;
				const errorMessage = error?.detail || 'Invalid code. Please try again.';
				return fail(400, {
					errors: { code: errorMessage },
					requires2FA: true,
					tempToken: data.tempToken
				});
			}

			// Success - store tokens and redirect
			if (response.data) {
				const { access, refresh } = response.data;

				// Store access token (15 minutes)
				cookies.set('access_token', access, {
					path: '/',
					httpOnly: true,
					secure: true,
					sameSite: 'lax',
					maxAge: 60 * 15
				});

				// Store refresh token
				const refreshMaxAge = data.rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24 * 7;
				cookies.set('refresh_token', refresh, {
					path: '/',
					httpOnly: true,
					secure: true,
					sameSite: 'lax',
					maxAge: refreshMaxAge
				});

				// Redirect to returnUrl or dashboard
				const returnUrl = url.searchParams.get('returnUrl') || '/dashboard';
				throw redirect(303, returnUrl);
			}

			return fail(400, {
				errors: { code: 'Invalid response from server' },
				requires2FA: true,
				tempToken: data.tempToken
			});
		} catch (error) {
			if (error instanceof Response) {
				throw error; // Re-throw redirect
			}

			return fail(500, {
				errors: { code: 'An unexpected error occurred. Please try again.' },
				requires2FA: true,
				tempToken: data.tempToken
			});
		}
	}
} satisfies Actions;
