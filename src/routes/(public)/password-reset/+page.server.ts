import { fail, type Actions } from '@sveltejs/kit';
import { passwordResetRequestSchema } from '$lib/schemas/auth';
import { accountResetPasswordRequestA2549D65 } from '$lib/api/generated';

export const actions: Actions = {
	resetRequest: async ({ request }) => {
		const formData = await request.formData();
		const email = formData.get('email') as string;

		// Validate form data
		const result = passwordResetRequestSchema.safeParse({ email });

		if (!result.success) {
			const errors: Record<string, string> = {};
			result.error.errors.forEach((error) => {
				if (error.path[0]) {
					errors[error.path[0].toString()] = error.message;
				}
			});

			return fail(400, {
				errors,
				email
			});
		}

		try {
			// Call backend API to send password reset email
			await accountResetPasswordRequestA2549D65({
				body: {
					email: result.data.email
				}
			});

			// Always return success to prevent user enumeration
			// The backend will only send an email if the account exists
			return {
				success: true,
				email: result.data.email
			};
		} catch (error) {
			console.error('Password reset request error:', error);

			// Even on error, return success to prevent user enumeration
			// The user will see the success message and check their email
			return {
				success: true,
				email: result.data.email
			};
		}
	}
};
