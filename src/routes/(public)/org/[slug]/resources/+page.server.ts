import { organizationListResources, organizationGetOrganization } from '$lib/api/generated/sdk.gen';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { extractErrorMessage } from '$lib/utils/errors';

export const load: PageServerLoad = async ({ params, fetch, locals }) => {
	// Prepare headers with authentication if user is logged in
	const headers: HeadersInit = {};
	if (locals.user?.accessToken) {
		headers['Authorization'] = `Bearer ${locals.user.accessToken}`;
	}

	// Fetch organization details
	const organizationResponse = await organizationGetOrganization({
		fetch,
		path: { slug: params.slug },
		headers
	});

	if (organizationResponse.error) {
		const errorMessage = extractErrorMessage(organizationResponse.error, 'Organization not found');
		throw error(404, errorMessage);
	}

	// Fetch resources for this organization (pass auth to see restricted resources)
	const resourcesResponse = await organizationListResources({
		fetch,
		path: { slug: params.slug },
		headers
	});

	if (resourcesResponse.error) {
		const errorMessage = extractErrorMessage(resourcesResponse.error, 'Failed to load resources');
		throw error(500, errorMessage);
	}

	return {
		organization: organizationResponse.data,
		resources: resourcesResponse.data?.results || []
	};
};
