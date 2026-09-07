import type { PageServerLoad } from './$types';
import { buildSeo } from '$lib/seo';
import { resolveLang } from '$lib/seo/server';
import { getDemoBookingUrl } from '$lib/server/features';

export const load: PageServerLoad = async ({ request, url, fetch }) => {
	const lang = resolveLang(request);
	const seo = buildSeo({ kind: 'home', url, lang });
	const demoBookingUrl = await getDemoBookingUrl(fetch);
	return { seo, demoBookingUrl };
};
