import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * Redirect from /login/confirm-email to /verify.
 * This handles the backend's email verification URL format.
 *
 * `returnUrl` (added to the link by the backend when registration carried a
 * `return_url`, BE #1023) is forwarded as an OPAQUE string: read once via
 * `searchParams` (one decode), re-encoded once. Never `decodeURIComponent`
 * it here — the backend accepts the harmless path `/%2F%2Fevil`, which only
 * becomes the open redirect `//evil` if decoded twice. `/verify` validates
 * it with `safeReturnUrl` before redirecting.
 */
export const load: PageServerLoad = async ({ url }) => {
	const token = url.searchParams.get('token');

	if (token) {
		const returnUrl = url.searchParams.get('returnUrl');
		const returnUrlQuery = returnUrl ? `&returnUrl=${encodeURIComponent(returnUrl)}` : '';
		// Redirect to the verify page with the token
		throw redirect(303, `/verify?token=${encodeURIComponent(token)}${returnUrlQuery}`);
	}

	// No token, redirect to verify page which will show error
	throw redirect(303, '/verify');
};
