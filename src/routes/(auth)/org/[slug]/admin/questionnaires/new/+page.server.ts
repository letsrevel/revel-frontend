import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	// Deliberately returns nothing from `locals.user`: it carries the access
	// token, which must never be serialized into the SSR HTML / __data.json.
	return {};
};
