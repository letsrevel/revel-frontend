import type { PageServerLoad } from './$types';
import { buildSeo } from '$lib/seo';
import { resolveLang } from '$lib/seo/server';
import { getDemoBookingUrl, getPlatformFeeConfig } from '$lib/server/features';

export const load: PageServerLoad = async ({ request, url, fetch }) => {
	const lang = resolveLang(request);
	const seo = buildSeo({ kind: 'home', url, lang });
	// Both read the same cached /version payload, so this costs one request.
	const [demoBookingUrl, feeConfig] = await Promise.all([
		getDemoBookingUrl(fetch),
		getPlatformFeeConfig(fetch)
	]);
	return { seo, demoBookingUrl, feeConfig };
};
