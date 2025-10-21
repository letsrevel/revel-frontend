import { organizationListResources } from '$lib/api/generated/sdk.gen';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent, fetch }) => {
	// Get organization from parent layout
	const { organization } = await parent();

	// Fetch public resources for this organization
	const resourcesResponse = await organizationListResources({
		fetch,
		path: { slug: params.slug }
	});

	if (resourcesResponse.error) {
		throw error(500, 'Failed to load resources');
	}

	return {
		organization,
		resources: resourcesResponse.data?.results || []
	};
};
