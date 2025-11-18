import { fail, redirect, isRedirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { registerSchema } from '$lib/schemas/auth';
import { accountRegister, apiApiVersion } from '$lib/api/generated/sdk.gen';

export const load: PageServerLoad = async ({ fetch }) => {
	// Check if backend is in demo mode
	try {
		const { data } = await apiApiVersion({ fetch });
		if (data?.demo) {
			// In demo mode, redirect to login page
			throw redirect(303, '/login');
		}
	} catch (error) {
		// Re-throw redirects
		if (isRedirect(error)) {
			throw error;
		}
		// If version check fails, allow registration to proceed
		console.error('[REGISTER] Failed to check demo mode:', error);
	}

	return {};
};

export const actions = {
	default: async ({ request, fetch }) => {
		const formData = await request.formData();
		const data = {
			email: formData.get('email') as string,
			password: formData.get('password') as string,
			confirmPassword: formData.get('confirmPassword') as string,
			acceptTerms: formData.get('acceptTerms') === 'on'
		};

		// Validate with Zod
		const validation = registerSchema.safeParse(data);
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
			// Call backend registration API
			const response = await accountRegister({
				body: {
					email: validation.data.email,
					password1: validation.data.password,
					password2: validation.data.confirmPassword,
					accept_toc_and_privacy: validation.data.acceptTerms
				},
				fetch
			});

			// DEBUG: Log the entire response structure
			console.log('[REGISTER] Full response:', {
				hasData: !!response.data,
				hasError: !!response.error,
				hasResponse: !!response.response,
				responseOk: response.response?.ok,
				responseStatus: response.response?.status,
				dataKeys: response.data ? Object.keys(response.data) : null,
				errorKeys: response.error ? Object.keys(response.error) : null
			});

			// Check response status - API client returns { data } on success, { error } on failure
			// On successful 201 Created, response.response.ok will be true
			if (response.response.ok && response.data) {
				console.log('[REGISTER] Success detected, redirecting to check-email');
				// Success - redirect to check-email page
				throw redirect(
					303,
					`/register/check-email?email=${encodeURIComponent(validation.data.email)}`
				);
			}

			// If response was not ok, handle the error
			if (!response.response.ok && response.error) {
				console.error('[REGISTER] Error response:', response.error);

				// The error structure from the API client varies
				// Try to extract error message from different possible structures
				let errorMessage = 'Registration failed';
				const error = response.error as any;

				if (typeof error === 'string') {
					errorMessage = error;
				} else if (error.detail) {
					errorMessage = error.detail;
				} else if (error.message) {
					errorMessage = error.message;
				} else if (error.email) {
					// Field-specific error
					return fail(400, {
						errors: { email: Array.isArray(error.email) ? error.email[0] : error.email },
						email: data.email
					});
				}

				// Check for specific error patterns
				if (
					errorMessage.toLowerCase().includes('already') ||
					errorMessage.toLowerCase().includes('exist')
				) {
					return fail(400, {
						errors: { email: 'An account with this email already exists' },
						email: data.email
					});
				}

				// Generic error
				return fail(400, {
					errors: { form: errorMessage },
					email: data.email
				});
			}

			// Neither data nor error (shouldn't happen)
			return fail(500, {
				errors: { form: 'Invalid response from server' },
				email: data.email
			});
		} catch (error) {
			// Re-throw redirects immediately without logging
			if (isRedirect(error)) {
				console.log('[REGISTER] Caught redirect, re-throwing');
				throw error;
			}

			// Only log actual unexpected errors
			console.error('[REGISTER] Unexpected registration error:', error);
			return fail(500, {
				errors: { form: 'An unexpected error occurred. Please try again.' },
				email: data.email
			});
		}
	}
} satisfies Actions;
