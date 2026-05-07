import type { PageServerLoad } from './$types';
import { buildSeo } from '$lib/seo';
import { resolveLang } from '$lib/seo/server';

export const load: PageServerLoad = async ({ request, url }) => {
	const lang = resolveLang(request);
	const seo = buildSeo({ kind: 'home', url, lang });
	return { seo };
};
