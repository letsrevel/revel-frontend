import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, url }) => {
	const accessToken = cookies.get('access_token');

	// Redirect to login if not authenticated
	if (!accessToken) {
		const returnUrl = encodeURIComponent(url.pathname);
		throw redirect(302, `/login?returnUrl=${returnUrl}`);
	}

	// Return access token for client-side API calls
	return {
		accessToken
	};
};
