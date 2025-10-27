import type { PageServerLoad } from './$types';
import { organizationListOrganizations } from '$lib/api';
import { error as svelteKitError } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ url, fetch, locals }) => {
	// Parse query parameters
	const search = url.searchParams.get('search') || undefined;
	const page = parseInt(url.searchParams.get('page') || '1');
	const pageSize = 20;

	// Parse filter parameters
	const cityId = url.searchParams.get('city_id');
	const tagsParam = url.searchParams.get('tags');
	const tags = tagsParam ? tagsParam.split(',').filter(Boolean) : undefined;
	const orderBy = url.searchParams.get('order_by') || 'distance';

	try {
		// Prepare query parameters
		const queryParams = {
			search,
			city_id: cityId ? parseInt(cityId) : undefined,
			tags,
			page,
			page_size: pageSize,
			order_by: orderBy as 'name' | '-name' | 'distance'
		};

		// Prepare headers with authentication if user is logged in
		const headers: HeadersInit = {};
		if (locals.user?.accessToken) {
			headers['Authorization'] = `Bearer ${locals.user.accessToken}`;
		}

		// Call the API with SSR-compatible fetch and auth headers
		const response = await organizationListOrganizations({
			fetch,
			query: queryParams,
			headers
		});

		// Handle API errors
		if (response.error) {
			console.error('[Organizations Load] Failed to fetch organizations:', response.error);
			throw svelteKitError(500, 'Failed to load organizations. Please try again later.');
		}

		// Type guard: ensure response.data exists
		if (!response.data) {
			console.error('[Organizations Load] Invalid API response - no data');
			throw svelteKitError(500, 'Invalid API response');
		}

		// Return paginated data
		return {
			organizations: response.data.results,
			totalCount: response.data.count,
			page,
			pageSize,
			nextUrl: response.data.next,
			previousUrl: response.data.previous,
			filters: {
				search,
				cityId: cityId ? parseInt(cityId) : undefined,
				tags,
				orderBy
			}
		};
	} catch (err) {
		console.error('Error loading organizations:', err);

		// Return empty state rather than throwing to allow graceful degradation
		return {
			organizations: [],
			totalCount: 0,
			page: 1,
			pageSize: 20,
			nextUrl: null,
			previousUrl: null,
			filters: {},
			error: 'Failed to load organizations. Please try again later.'
		};
	}
};
