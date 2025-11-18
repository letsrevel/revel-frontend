import { apiApiLegal } from '$lib/api';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	try {
		const legal = await apiApiLegal();
		return {
			privacyPolicy: legal.data?.privacy_policy_html ?? ''
		};
	} catch (err) {
		console.error('Failed to load privacy policy:', err);
		throw error(500, 'Failed to load privacy policy');
	}
};
