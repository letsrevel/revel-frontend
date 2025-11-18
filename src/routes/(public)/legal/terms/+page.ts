import { apiApiLegal } from '$lib/api';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	try {
		const legal = await apiApiLegal();
		return {
			termsAndConditions: legal.data?.terms_and_conditions_html ?? ''
		};
	} catch (err) {
		console.error('Failed to load terms of service:', err);
		throw error(500, 'Failed to load terms of service');
	}
};
