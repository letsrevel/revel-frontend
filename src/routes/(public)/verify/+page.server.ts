import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { accountVerifyEmail7D56Cf04 } from '$lib/api/generated/sdk.gen';

export const load: PageServerLoad = async ({ url, fetch, cookies }) => {
	const token = url.searchParams.get('token');

	if (!token) {
		return {
			success: false,
			error: 'Verification token is missing'
		};
	}

	try {
		// Verify the email token
		const response = await accountVerifyEmail7D56Cf04({
			body: { token },
			fetch
		});

		// Check response status - API client returns { data } on success, { error } on failure
		// On successful 200 OK, response.response.ok will be true
		if (response.response.ok && response.data) {
			const { access, refresh } = response.data.token;

			// Store tokens in httpOnly cookies
			if (access) {
				cookies.set('access_token', access, {
					path: '/',
					httpOnly: true,
					secure: true,
					sameSite: 'lax',
					maxAge: 60 * 15 // 15 minutes
				});
			}

			if (refresh) {
				cookies.set('refresh_token', refresh, {
					path: '/',
					httpOnly: true,
					secure: true,
					sameSite: 'lax',
					maxAge: 60 * 60 * 24 * 7 // 7 days
				});
			}

			// Redirect to dashboard after successful verification
			throw redirect(303, '/dashboard');
		}

		// If response was not ok, handle the error
		if (!response.response.ok && response.error) {
			console.error('Verification error:', response.error);
			const error = response.error as any;
			return {
				success: false,
				error: error?.detail || error?.message || 'Verification failed'
			};
		}

		// Neither data nor error (shouldn't happen)
		return {
			success: false,
			error: 'Invalid response from server'
		};
	} catch (error) {
		// Re-throw redirects immediately without logging
		if (error instanceof Response) {
			throw error;
		}

		// Only log actual unexpected errors
		console.error('Unexpected verification error:', error);
		return {
			success: false,
			error: 'An unexpected error occurred during verification'
		};
	}
};
