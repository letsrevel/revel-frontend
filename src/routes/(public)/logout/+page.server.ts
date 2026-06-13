import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { log } from '$lib/server/logger';

/**
 * Logout page - clears auth cookies and redirects to home
 * This is a GET endpoint (not a form action) to allow simple navigation-based logout
 *
 * Client-side state (authStore, query cache) is cleared in UserMenu.svelte
 * before navigating here. This server load only handles cookie cleanup.
 */
export const load: PageServerLoad = async ({ cookies }) => {
	log.debug('logout_clearing_cookies');

	// Clear access token cookie
	cookies.delete('access_token', { path: '/' });

	// Clear refresh token cookie
	cookies.delete('refresh_token', { path: '/' });

	// Clear "remember me" preference cookie
	cookies.delete('remember_me', { path: '/' });

	// Redirect to home page with full page reload to ensure layout re-runs
	throw redirect(303, '/?logged_out=true');
};
