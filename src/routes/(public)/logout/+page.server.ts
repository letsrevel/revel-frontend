import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * Logout page - clears auth cookies and redirects to home
 * This is a GET endpoint (not a form action) to allow simple navigation-based logout
 *
 * Client-side state (authStore, query cache) is cleared in UserMenu.svelte
 * before navigating here. This server load only handles cookie cleanup.
 */
export const load: PageServerLoad = async ({ cookies }) => {
	console.log('[LOGOUT] Clearing authentication cookies');

	// Clear access token cookie
	cookies.delete('access_token', { path: '/' });

	// Clear refresh token cookie
	cookies.delete('refresh_token', { path: '/' });

	// Clear "remember me" preference cookie
	cookies.delete('remember_me', { path: '/' });

	// Redirect to home page with full page reload to ensure layout re-runs
	throw redirect(303, '/?logged_out=true');
};
