/**
 * Filter state management utilities for organization listing
 * Handles URL param synchronization and filter state
 */

/**
 * Organization filter state interface
 */
export interface OrganizationFilters {
	search?: string;
	cityId?: number;
	tags?: string[];
	orderBy?: 'name' | '-name' | 'distance';
	page?: number;
	pageSize?: number;
}

/**
 * Parse URL search params into filter state
 * @param searchParams URLSearchParams from URL
 * @returns Parsed filter state
 */
export function parseOrganizationFilters(searchParams: URLSearchParams): OrganizationFilters {
	const filters: OrganizationFilters = {};

	// Search text
	const search = searchParams.get('search');
	if (search) filters.search = search;

	// City ID
	const cityId = searchParams.get('city_id');
	if (cityId) filters.cityId = parseInt(cityId, 10);

	// Tags (comma-separated)
	const tags = searchParams.get('tags');
	if (tags) filters.tags = tags.split(',').filter(Boolean);

	// Order by
	const orderBy = searchParams.get('order_by');
	if (orderBy === 'name' || orderBy === '-name' || orderBy === 'distance') {
		filters.orderBy = orderBy;
	}

	// Pagination
	const page = searchParams.get('page');
	if (page) filters.page = parseInt(page, 10);

	const pageSize = searchParams.get('page_size');
	if (pageSize) filters.pageSize = parseInt(pageSize, 10);

	return filters;
}

/**
 * Convert filter state to URL search params
 * @param filters Filter state object
 * @returns URLSearchParams ready for navigation
 */
export function organizationFiltersToParams(filters: OrganizationFilters): URLSearchParams {
	const params = new URLSearchParams();

	if (filters.search) params.set('search', filters.search);
	if (filters.cityId) params.set('city_id', filters.cityId.toString());
	if (filters.tags && filters.tags.length > 0) params.set('tags', filters.tags.join(','));
	if (filters.orderBy) params.set('order_by', filters.orderBy);
	if (filters.page && filters.page > 1) params.set('page', filters.page.toString());
	if (filters.pageSize && filters.pageSize !== 20) {
		params.set('page_size', filters.pageSize.toString());
	}

	return params;
}

/**
 * Convert filter state to API query parameters
 * @param filters Filter state object
 * @returns Object ready for API client
 */
export function organizationFiltersToApiParams(filters: OrganizationFilters) {
	return {
		search: filters.search,
		city_id: filters.cityId,
		tags: filters.tags,
		order_by: filters.orderBy ?? 'distance',
		page: filters.page ?? 1,
		page_size: filters.pageSize ?? 20
	};
}

/**
 * Check if any filters are active (excluding pagination)
 * @param filters Filter state object
 * @returns true if any filters are active
 */
export function hasActiveOrganizationFilters(filters: OrganizationFilters): boolean {
	return !!(
		filters.search ||
		filters.cityId ||
		(filters.tags && filters.tags.length > 0) ||
		(filters.orderBy && filters.orderBy !== 'distance')
	);
}

/**
 * Count number of active filters (excluding pagination)
 * @param filters Filter state object
 * @returns Number of active filters
 */
export function countActiveOrganizationFilters(filters: OrganizationFilters): number {
	let count = 0;

	if (filters.search) count++;
	if (filters.cityId) count++;
	if (filters.tags && filters.tags.length > 0) count += filters.tags.length;
	if (filters.orderBy && filters.orderBy !== 'distance') count++;

	return count;
}

/**
 * Clear all filters (reset to defaults)
 * @returns Empty filter state
 */
export function clearOrganizationFilters(): OrganizationFilters {
	return {
		page: 1,
		pageSize: 20
	};
}
