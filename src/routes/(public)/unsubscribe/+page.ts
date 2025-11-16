import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url }) => {
	// Extract token from URL query parameter
	const token = url.searchParams.get('token');

	return {
		token
	};
};
