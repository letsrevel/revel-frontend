import { apiApiLegal } from '$lib/api';
import { buildSeo } from '$lib/seo';
import { resolveLang } from '$lib/seo/server';
import { error } from '@sveltejs/kit';
import { log } from '$lib/server/logger';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, request, fetch }) => {
	const lang = resolveLang(request);
	const seo = buildSeo({ kind: 'legal', url, lang, doc: 'terms' });

	try {
		const legal = await apiApiLegal({ fetch });
		return {
			seo,
			termsAndConditions: legal.data?.terms_and_conditions ?? ''
		};
	} catch (err) {
		log.error('terms_load_failed', { error: err });
		throw error(500, 'Failed to load terms of service');
	}
};
