import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * Logout page - clears auth cookies and redirects to home
 * This is a GET endpoint (not a form action) to allow simple navigation-based logout
 *
 * The client-side +page.svelte will clear authStore immediately on mount,
 * then this server load will clear cookies and redirect.
 */
export const load: PageServerLoad = async ({ cookies }) => {
	console.log('[LOGOUT] Clearing authentication cookies');

	// Clear access token cookie
	cookies.delete('access_token', { path: '/' });

	// Clear refresh token cookie
	cookies.delete('refresh_token', { path: '/' });

	// Small delay to ensure client-side auth state is cleared first
	// This prevents race conditions where the redirect happens before onMount
	await new Promise((resolve) => setTimeout(resolve, 100));

	// Redirect to home page
	throw redirect(303, '/');
};
