import * as m from '$lib/paraglide/messages.js';
import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ parent, locals }) => {
	const { organization } = await parent();
	const user = locals.user;

	if (!user) {
		throw error(401, m['serverErrors.admin.loginRequiredCreateSeries']());
	}

	return {
		organization
	};
};
