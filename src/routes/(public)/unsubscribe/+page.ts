import type { PageLoad } from './$types';
import { buildSeo } from '$lib/seo';

export const load: PageLoad = ({ url }) => {
	// Extract token from URL query parameter
	const token = url.searchParams.get('token');
	const seo = buildSeo({ kind: 'auth', url, lang: 'en', page: 'unsubscribe' });

	return {
		token,
		seo
	};
};
