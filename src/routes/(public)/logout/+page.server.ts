import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { log } from '$lib/server/logger';
import { safeReturnUrl } from '$lib/utils/safe-redirect';

/**
 * Logout page - clears auth cookies and redirects.
 * This is a GET endpoint (not a form action) to allow simple navigation-based logout.
 *
 * Client-side state (authStore, query cache) is cleared in UserMenu.svelte
 * before navigating here. This server load only handles cookie cleanup.
 *
 * With `?returnUrl=` ("switch account" on the OAuth consent page) the user is
 * sent to /login carrying that target, so they re-authenticate and land back
 * where they were. Without it, home with the logged-out flag, as before. A
 * link to /logout?returnUrl=… from an authenticated page must use
 * `data-sveltekit-reload`, since only a full document navigation drops the
 * in-memory auth store.
 */
export const load: PageServerLoad = async ({ cookies, url }) => {
	log.debug('logout_clearing_cookies');

	// Clear access token cookie
	cookies.delete('access_token', { path: '/' });

	// Clear refresh token cookie
	cookies.delete('refresh_token', { path: '/' });

	// Clear "remember me" preference cookie
	cookies.delete('remember_me', { path: '/' });

	const returnUrl = safeReturnUrl(url.searchParams.get('returnUrl'), '');
	if (returnUrl) {
		throw redirect(303, `/login?returnUrl=${encodeURIComponent(returnUrl)}`);
	}

	// Redirect to home page with full page reload to ensure layout re-runs
	throw redirect(303, '/?logged_out=true');
};
