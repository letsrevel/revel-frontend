import type { PageServerLoad } from './$types';
import { eventListEventsDacbb89B } from '$lib/api';
import { error as svelteKitError } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ url, fetch }) => {
	console.log('[Events Load] Loading with URL:', url.toString());

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
	const orderBy = url.searchParams.get('order_by') || 'start';

	try {
		// Prepare query parameters
		const queryParams = {
			search,
			city_id: cityId ? parseInt(cityId) : undefined,
			organization,
			event_type: eventType as 'public' | 'private' | 'members-only' | undefined,
			visibility: visibility as 'public' | 'private' | 'members-only' | 'staff-only' | undefined,
			tags,
			page,
			page_size: pageSize,
			include_past: includePast,
			order_by: orderBy as 'start' | '-start' | 'distance'
		};

		console.log('[Events Load] API Query Params:', queryParams);

		// Call the API with SSR-compatible fetch
		const response = await eventListEventsDacbb89B({
			fetch,
			query: queryParams
		});

		// Handle API errors
		if (response.error) {
			console.error('Failed to fetch events:', response.error);
			throw svelteKitError(500, 'Failed to load events. Please try again later.');
		}

		// Type guard: ensure response.data exists
		if (!response.data) {
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
