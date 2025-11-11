import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

// Disable SSR for this page - token validation must happen client-side
export const ssr = false;

export const load: PageLoad = ({ url }) => {
	const token = url.searchParams.get('token');

	// Redirect to home if no token provided
	if (!token) {
		throw redirect(302, '/');
	}

	return {
		token
	};
};
