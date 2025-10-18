import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * Logout page - clears auth cookies and redirects to home
 * This is a GET endpoint (not a form action) to allow simple navigation-based logout
 */
export const load: PageServerLoad = async ({ cookies }) => {
	console.log('[LOGOUT] Clearing authentication cookies');

	// Clear access token cookie
	cookies.delete('access_token', { path: '/' });

	// Clear refresh token cookie
	cookies.delete('refresh_token', { path: '/' });

	// Redirect to home page
	throw redirect(303, '/');
};
