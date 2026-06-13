import { redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { API_BASE_URL } from '$lib/config/api';
import { getAccessTokenCookieOptions } from '$lib/utils/cookies';
import { log } from '$lib/server/logger';

/**
 * Impersonation token response from backend
 */
interface ImpersonationResponse {
	access_token: string;
	expires_in: number;
	user: {
		id: string;
		email: string;
		display_name: string;
		first_name: string;
		last_name: string;
	};
	impersonated_by: string;
}

/**
 * Server-side load function for impersonation page
 *
 * Handles the impersonation token exchange when redirected from admin panel.
 * The token is passed as a query parameter: /impersonate?token=xxx
 *
 * On success: Sets access token cookie and redirects to dashboard
 * On failure: Returns error for display on the page
 */
export const load: PageServerLoad = async ({ url, cookies, fetch }) => {
	const token = url.searchParams.get('token');

	// If no token provided, show error page
	if (!token) {
		return {
			error: 'missing_token',
			errorMessage: 'No impersonation token provided.'
		};
	}

	log.debug('impersonate_token_exchange_started');

	try {
		// Exchange the impersonation token for an access token
		const response = await fetch(`${API_BASE_URL}/api/auth/impersonate`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ token })
		});

		if (!response.ok) {
			const status = response.status;
			log.error('impersonate_token_exchange_failed', { status });

			if (status === 401) {
				return {
					error: 'invalid_token',
					errorMessage: 'The impersonation token is invalid, expired, or has already been used.'
				};
			}

			if (status === 403) {
				return {
					error: 'forbidden',
					errorMessage:
						'Impersonation is no longer allowed for this user (they may have become staff or superuser).'
				};
			}

			return {
				error: 'unknown',
				errorMessage: 'An unexpected error occurred. Please try again or contact support.'
			};
		}

		const data: ImpersonationResponse = await response.json();
		log.debug('impersonate_token_exchange_successful', { user_id: data.user.id });

		// IMPORTANT: For impersonation sessions, we only set the access token.
		// NO refresh token - impersonation sessions should not be extendable.
		// The access token will expire in 15 minutes and the admin must re-initiate.

		// Use a shorter maxAge for impersonation sessions (15 minutes = 900 seconds)
		const cookieOptions = {
			...getAccessTokenCookieOptions(true),
			maxAge: data.expires_in // Use the server-provided expiry time
		};

		cookies.set('access_token', data.access_token, cookieOptions);

		// Clear any existing refresh token to prevent auto-refresh
		// This ensures impersonation sessions cannot be extended
		cookies.delete('refresh_token', { path: '/' });
		cookies.delete('remember_me', { path: '/' });

		log.debug('impersonate_redirecting_to_dashboard');

		// Redirect to dashboard
		throw redirect(302, '/dashboard');
	} catch (err) {
		// Re-throw redirects
		if (err && typeof err === 'object' && 'status' in err && err.status === 302) {
			throw err;
		}

		log.error('impersonate_error', { error: err });

		return {
			error: 'network',
			errorMessage: 'Failed to connect to the server. Please check your connection and try again.'
		};
	}
};
