import { redirect, isRedirect } from '@sveltejs/kit';
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
		console.log('[VERIFY] Starting verification for token');

		// Verify the email token
		const response = await accountVerifyEmail7D56Cf04({
			body: { token },
			fetch
		});

		console.log('[VERIFY] Response received', {
			ok: response.response.ok,
			hasData: !!response.data
		});

		// Check response status - API client returns { data } on success, { error } on failure
		if (response.response.ok && response.data) {
			// Backend returns { user: {...}, token: { access: '...', refresh: '...' } }
			const tokens = response.data.token as { access: string; refresh: string };
			const { access, refresh } = tokens;

			console.log('[VERIFY] Success! Setting cookies', {
				hasAccess: !!access,
				hasRefresh: !!refresh
			});

			// Store tokens in httpOnly cookies
			if (access) {
				cookies.set('access_token', access, {
					path: '/',
					httpOnly: true,
					secure: false, // Set to true in production via environment
					sameSite: 'lax',
					maxAge: 60 * 15 // 15 minutes
				});
				console.log('[VERIFY] Access token cookie set');
			}

			if (refresh) {
				cookies.set('refresh_token', refresh, {
					path: '/',
					httpOnly: true,
					secure: false, // Set to true in production via environment
					sameSite: 'lax',
					maxAge: 60 * 60 * 24 * 7 // 7 days
				});
				console.log('[VERIFY] Refresh token cookie set');
			}

			// Redirect to dashboard after successful verification
			console.log('[VERIFY] Redirecting to /dashboard');
			throw redirect(303, '/dashboard');
		}

		// If response was not ok, handle the error
		if (!response.response.ok && response.error) {
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
		// Re-throw redirects immediately
		if (isRedirect(error)) {
			throw error;
		}

		// Log unexpected errors
		console.error('[VERIFY] Unexpected verification error:', error);
		return {
			success: false,
			error: 'An unexpected error occurred during verification'
		};
	}
};
