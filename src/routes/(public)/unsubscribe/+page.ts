import type { PageLoad } from './$types';
import { buildSeo } from '$lib/seo';
import { readUnsubscribeToken } from '$lib/utils/unsubscribe-token';

export const load: PageLoad = ({ url }) => {
	// Extract token from URL query parameter
	const token = url.searchParams.get('token');
	const seo = buildSeo({ kind: 'auth', url, lang: 'en', page: 'unsubscribe' });

	return {
		token,
		// Decoded (not verified) so expired/malformed links show the invalid-link
		// state on load rather than failing at submit (#982).
		tokenInfo: readUnsubscribeToken(token),
		seo
	};
};
