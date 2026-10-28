import type { PageServerLoad } from './$types';
import { buildSeo } from '$lib/seo';
import { resolveLang } from '$lib/seo/server';
import { getDemoBookingUrl, getPlatformFeeConfig } from '$lib/server/features';
import { loadOrgPage } from '$lib/server/org-page';

/**
 * `/` is the platform landing page, except on a tenant host (#1056) where it
 * is the tenant organization's page rendered at the root URL.
 */
export const load: PageServerLoad = async (event) => {
	const { tenant } = event.locals;
	if (tenant) {
		return { kind: 'org' as const, ...(await loadOrgPage(event, tenant.slug)) };
	}

	const lang = resolveLang(event.request);
	const seo = buildSeo({ kind: 'home', url: event.url, lang });
	// Both read the same cached /version payload, so this costs one request.
	const [demoBookingUrl, feeConfig] = await Promise.all([
		getDemoBookingUrl(event.fetch),
		getPlatformFeeConfig(fetch)
	]);
	return { kind: 'landing' as const, seo, demoBookingUrl, feeConfig };
};
