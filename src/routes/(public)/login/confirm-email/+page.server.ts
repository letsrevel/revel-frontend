import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * Redirect from /login/confirm-email to /verify
 * This handles the backend's email verification URL format
 */
export const load: PageServerLoad = async ({ url }) => {
	const token = url.searchParams.get('token');

	if (token) {
		// Redirect to the verify page with the token
		throw redirect(303, `/verify?token=${encodeURIComponent(token)}`);
	}

	// No token, redirect to verify page which will show error
	throw redirect(303, '/verify');
};
