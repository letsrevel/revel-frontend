import { organizationListResources, organizationRetrieveOrganization } from '$lib/api/generated/sdk.gen';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, fetch }) => {
	// Fetch organization details
	const organizationResponse = await organizationRetrieveOrganization({
		fetch,
		path: { slug: params.slug }
	});

	if (organizationResponse.error) {
		throw error(404, 'Organization not found');
	}

	// Fetch public resources for this organization
	const resourcesResponse = await organizationListResources({
		fetch,
		path: { slug: params.slug }
	});

	if (resourcesResponse.error) {
		throw error(500, 'Failed to load resources');
	}

	return {
		organization: organizationResponse.data,
		resources: resourcesResponse.data?.results || []
	};
};
