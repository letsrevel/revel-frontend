import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { log } from '$lib/server/logger';
import { safeReturnUrl } from '$lib/utils/safe-redirect';

/**
 * Logout.
 *
 * Only a POST changes auth state. Auth cookies are SameSite=Lax, so they ride
 * along on top-level cross-site GET navigations: a state-changing GET would let
 * any third-party page log a user out with a plain link or redirect. SvelteKit's
 * built-in origin check on form actions rejects cross-site POSTs.
 *
 * GET never touches cookies. Signed out, it forwards on; signed in, it renders
 * a confirmation page whose native form POSTs back here. The POST must stay a
 * native (non-`use:enhance`) submission: the 303 then produces a full document
 * load, the only thing that drops the in-memory auth store.
 *
 * Client-side state (authStore, query cache) is cleared in UserMenu.svelte
 * before it submits the POST; the action only handles cookie cleanup.
 *
 * With a `returnUrl` ("switch account" on the OAuth consent page) the user is
 * sent to /login carrying that target, so they re-authenticate and land back
 * where they were. Without it, home with the logged-out flag. The value is
 * validated by `safeReturnUrl` on both GET and POST.
 */
export const load: PageServerLoad = async ({ cookies, url, locals }) => {
	const returnUrl = safeReturnUrl(url.searchParams.get('returnUrl'), '');
	const signedIn = !!locals.user || !!cookies.get('refresh_token');

	if (!signedIn) {
		throw redirect(303, returnUrl ? `/login?returnUrl=${encodeURIComponent(returnUrl)}` : '/');
	}

	return { returnUrl };
};

export const actions: Actions = {
	default: async ({ cookies, request }) => {
		log.debug('logout_clearing_cookies');

		cookies.delete('access_token', { path: '/' });
		cookies.delete('refresh_token', { path: '/' });
		// "remember me" preference cookie
		cookies.delete('remember_me', { path: '/' });

		const form = await request.formData();
		const raw = form.get('returnUrl');
		const returnUrl = safeReturnUrl(typeof raw === 'string' ? raw : null, '');
		if (returnUrl) {
			throw redirect(303, `/login?returnUrl=${encodeURIComponent(returnUrl)}`);
		}

		throw redirect(303, '/?logged_out=true');
	}
};
