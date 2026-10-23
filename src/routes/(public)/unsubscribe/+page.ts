import type { PageLoad } from './$types';
import { buildSeo } from '$lib/seo';

export const load: PageLoad = async ({ url, data, parent }) => {
	// Extract token from URL query parameter
	const token = url.searchParams.get('token');
	const { tenant } = await parent();
	const seo = buildSeo({ kind: 'auth', url, lang: 'en', page: 'unsubscribe', tenant });

	return {
		...data,
		token,
		seo
	};
};
