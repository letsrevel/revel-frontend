import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	// Just inherit from parent layout (organization data)
	await parent();
	return {};
};
