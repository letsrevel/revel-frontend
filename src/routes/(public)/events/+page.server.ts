import type { PageServerLoad } from './$types';
import { eventListEvents } from '$lib/api';
import { error as svelteKitError } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ url, fetch, locals }) => {
	// Parse query parameters
	const search = url.searchParams.get('search') || undefined;
	const page = parseInt(url.searchParams.get('page') || '1');
	const pageSize = 20;

	// Parse filter parameters
	const cityId = url.searchParams.get('city_id');
	const organization = url.searchParams.get('organization') || undefined;
	const eventType = url.searchParams.get('event_type') || undefined;
	const visibility = url.searchParams.get('visibility') || undefined;
	const tagsParam = url.searchParams.get('tags');
	const tags = tagsParam ? tagsParam.split(',').filter(Boolean) : undefined;
	const includePast = url.searchParams.get('include_past') === 'true';
	const orderBy = url.searchParams.get('order_by') || 'distance';

	try {
		// Prepare query parameters
		const queryParams = {
			search,
			city_id: cityId ? parseInt(cityId) : undefined,
			organization,
			event_type: eventType as any,
			visibility: visibility as any,
			tags,
			page,
			page_size: pageSize,
			include_past: includePast,
			order_by: orderBy as any
		};

		// Prepare headers with authentication if user is logged in
		const headers: HeadersInit = {};
		if (locals.user?.accessToken) {
			headers['Authorization'] = `Bearer ${locals.user.accessToken}`;
		}

		// Call the API with SSR-compatible fetch and auth headers
		const response = await eventListEvents({
			fetch,
			query: queryParams,
			headers
		});

		// Handle API errors
		if (response.error) {
			console.error('[Events Load] Failed to fetch events:', response.error);
			throw svelteKitError(500, 'Failed to load events. Please try again later.');
		}

		// Type guard: ensure response.data exists
		if (!response.data) {
			console.error('[Events Load] Invalid API response - no data');
			throw svelteKitError(500, 'Invalid API response');
		}

		// Return paginated data
		return {
			events: response.data.results,
			totalCount: response.data.count,
			page,
			pageSize,
			nextUrl: response.data.next,
			previousUrl: response.data.previous,
			filters: {
				search,
				cityId: cityId ? parseInt(cityId) : undefined,
				organization,
				eventType,
				visibility,
				tags,
				includePast,
				orderBy
			}
		};
	} catch (err) {
		console.error('Error loading events:', err);

		// Return empty state rather than throwing to allow graceful degradation
		return {
			events: [],
			totalCount: 0,
			page: 1,
			pageSize: 20,
			nextUrl: null,
			previousUrl: null,
			filters: {},
			error: 'Failed to load events. Please try again later.'
		};
	}
};
