import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { registerSchema } from '$lib/schemas/auth';
import { accountRegisterCed95Cc4 } from '$lib/api/generated/sdk.gen';

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
			const response = await accountRegisterCed95Cc4({
				body: {
					email: validation.data.email,
					password1: validation.data.password,
					password2: validation.data.confirmPassword
				},
				fetch
			});

			// Check for success first (201 Created)
			if (response.data) {
				// Success - redirect to check-email page
				throw redirect(303, `/register/check-email?email=${encodeURIComponent(validation.data.email)}`);
			}

			// If no data, check for errors
			if (response.error) {
				console.error('Registration error:', response.error);

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
				if (errorMessage.toLowerCase().includes('already') ||
				    errorMessage.toLowerCase().includes('exist')) {
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
			if (error instanceof Response) {
				throw error; // Re-throw redirect
			}

			console.error('Unexpected registration error:', error);
			return fail(500, {
				errors: { form: 'An unexpected error occurred. Please try again.' },
				email: data.email
			});
		}
	}
} satisfies Actions;
