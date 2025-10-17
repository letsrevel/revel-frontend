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

			if (response.error) {
				// Check for specific errors
				const errorMessage = (response.error as any).message || 'Registration failed';

				// Email already exists
				if (errorMessage.toLowerCase().includes('email') && errorMessage.toLowerCase().includes('exists')) {
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

			// Success - redirect to check-email page
			throw redirect(303, `/register/check-email?email=${encodeURIComponent(validation.data.email)}`);
		} catch (error) {
			if (error instanceof Response) {
				throw error; // Re-throw redirect
			}

			return fail(500, {
				errors: { form: 'An unexpected error occurred. Please try again.' },
				email: data.email
			});
		}
	}
} satisfies Actions;
