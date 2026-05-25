import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, url }) => {
	const accessToken = cookies.get('access_token');

	// Redirect to login if not authenticated. The client reads the token from
	// authStore (not from page data — that would serialize the JWT into HTML).
	if (!accessToken) {
		const returnUrl = encodeURIComponent(url.pathname);
		throw redirect(302, `/login?returnUrl=${returnUrl}`);
	}

	return {};
};
