import { apiApiLegal } from '$lib/api';
import { buildSeo } from '$lib/seo';
import { resolveLang } from '$lib/seo/server';
import { error } from '@sveltejs/kit';
import { log } from '$lib/server/logger';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, request, fetch }) => {
	const lang = resolveLang(request);
	const seo = buildSeo({ kind: 'legal', url, lang, doc: 'privacy' });

	try {
		const legal = await apiApiLegal({ fetch });
		return {
			seo,
			privacyPolicy: legal.data?.privacy_policy ?? ''
		};
	} catch (err) {
		log.error('privacy_policy_load_failed', { error: err });
		throw error(500, 'Failed to load privacy policy');
	}
};
