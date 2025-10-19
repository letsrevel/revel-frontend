/**
 * Filter state management utilities for event listing
 * Handles URL param synchronization and filter state
 */

/**
 * Filter state interface
 */
export interface EventFilters {
	search?: string;
	cityId?: number;
	organizationId?: string;
	eventType?: 'public' | 'private' | 'members-only';
	visibility?: 'public' | 'private' | 'members-only' | 'staff-only';
	tags?: string[];
	includePast?: boolean;
	orderBy?: 'start' | '-start' | 'distance';
	page?: number;
	pageSize?: number;
}

/**
 * Date preset options for quick filtering
 */
export type DatePreset = 'today' | 'this-week' | 'this-month' | 'future';

/**
 * Parse URL search params into filter state
 * @param searchParams URLSearchParams from URL
 * @returns Parsed filter state
 */
export function parseFilters(searchParams: URLSearchParams): EventFilters {
	const filters: EventFilters = {};

	// Search text
	const search = searchParams.get('search');
	if (search) filters.search = search;

	// City ID
	const cityId = searchParams.get('city_id');
	if (cityId) filters.cityId = parseInt(cityId, 10);

	// Organization ID
	const organizationId = searchParams.get('organization');
	if (organizationId) filters.organizationId = organizationId;

	// Event type
	const eventType = searchParams.get('event_type');
	if (eventType === 'public' || eventType === 'private' || eventType === 'members-only') {
		filters.eventType = eventType;
	}

	// Visibility
	const visibility = searchParams.get('visibility');
	if (
		visibility === 'public' ||
		visibility === 'private' ||
		visibility === 'members-only' ||
		visibility === 'staff-only'
	) {
		filters.visibility = visibility;
	}

	// Tags (comma-separated)
	const tags = searchParams.get('tags');
	if (tags) filters.tags = tags.split(',').filter(Boolean);

	// Include past events
	const includePast = searchParams.get('include_past');
	if (includePast === 'true') filters.includePast = true;

	// Order by
	const orderBy = searchParams.get('order_by');
	if (orderBy === 'start' || orderBy === '-start' || orderBy === 'distance') {
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
export function filtersToParams(filters: EventFilters): URLSearchParams {
	const params = new URLSearchParams();

	if (filters.search) params.set('search', filters.search);
	if (filters.cityId) params.set('city_id', filters.cityId.toString());
	if (filters.organizationId) params.set('organization', filters.organizationId);
	if (filters.eventType) params.set('event_type', filters.eventType);
	if (filters.visibility) params.set('visibility', filters.visibility);
	if (filters.tags && filters.tags.length > 0) params.set('tags', filters.tags.join(','));
	if (filters.includePast) params.set('include_past', 'true');
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
export function filtersToApiParams(filters: EventFilters) {
	return {
		search: filters.search,
		city_id: filters.cityId,
		organization: filters.organizationId,
		event_type: filters.eventType,
		visibility: filters.visibility,
		tags: filters.tags,
		include_past: filters.includePast ?? false,
		order_by: filters.orderBy ?? 'distance', // Default to 'distance' (nearest first)
		page: filters.page ?? 1,
		page_size: filters.pageSize ?? 20
	};
}

/**
 * Check if any filters are active (excluding pagination)
 * @param filters Filter state object
 * @returns true if any filters are active
 */
export function hasActiveFilters(filters: EventFilters): boolean {
	return !!(
		filters.search ||
		filters.cityId ||
		filters.organizationId ||
		filters.eventType ||
		filters.visibility ||
		(filters.tags && filters.tags.length > 0) ||
		filters.includePast ||
		(filters.orderBy && filters.orderBy !== 'distance') // 'distance' is now the default
	);
}

/**
 * Count number of active filters (excluding pagination)
 * @param filters Filter state object
 * @returns Number of active filters
 */
export function countActiveFilters(filters: EventFilters): number {
	let count = 0;

	if (filters.search) count++;
	if (filters.cityId) count++;
	if (filters.organizationId) count++;
	if (filters.eventType) count++;
	if (filters.visibility) count++;
	if (filters.tags && filters.tags.length > 0) count += filters.tags.length;
	if (filters.includePast) count++;
	if (filters.orderBy && filters.orderBy !== 'distance') count++; // 'distance' is now the default

	return count;
}

/**
 * Clear all filters (reset to defaults)
 * @returns Empty filter state
 */
export function clearFilters(): EventFilters {
	return {
		page: 1,
		pageSize: 20
	};
}

/**
 * Update a single filter property
 * @param currentFilters Current filter state
 * @param key Filter property to update
 * @param value New value (undefined to remove)
 * @returns Updated filter state
 */
export function updateFilter<K extends keyof EventFilters>(
	currentFilters: EventFilters,
	key: K,
	value: EventFilters[K]
): EventFilters {
	const updated = { ...currentFilters };

	if (value === undefined || value === null) {
		delete updated[key];
	} else {
		updated[key] = value;
	}

	// Reset to page 1 when filters change (except pagination changes)
	if (key !== 'page' && key !== 'pageSize') {
		updated.page = 1;
	}

	return updated;
}

/**
 * Merge multiple filter updates
 * @param currentFilters Current filter state
 * @param updates Partial filter updates
 * @returns Updated filter state
 */
export function mergeFilters(
	currentFilters: EventFilters,
	updates: Partial<EventFilters>
): EventFilters {
	const merged = { ...currentFilters, ...updates };

	// Reset to page 1 if non-pagination filters changed
	const nonPaginationChanged = Object.keys(updates).some(
		(key) => key !== 'page' && key !== 'pageSize'
	);
	if (nonPaginationChanged) {
		merged.page = 1;
	}

	return merged;
}

/**
 * Get user-friendly display text for active filters
 * @param filters Filter state object
 * @returns Array of filter descriptions
 */
export function getFilterDescriptions(filters: EventFilters): string[] {
	const descriptions: string[] = [];

	if (filters.search) {
		descriptions.push(`Search: "${filters.search}"`);
	}

	if (filters.cityId) {
		descriptions.push(`Location filter active`);
	}

	if (filters.organizationId) {
		descriptions.push(`Organization filter active`);
	}

	if (filters.eventType) {
		descriptions.push(`Type: ${filters.eventType}`);
	}

	if (filters.visibility) {
		descriptions.push(`Visibility: ${filters.visibility}`);
	}

	if (filters.tags && filters.tags.length > 0) {
		descriptions.push(`Tags: ${filters.tags.join(', ')}`);
	}

	if (filters.includePast) {
		descriptions.push(`Including past events`);
	}

	if (filters.orderBy === '-start') {
		descriptions.push(`Sorted: Latest first`);
	} else if (filters.orderBy === 'start') {
		descriptions.push(`Sorted: Soonest first`);
	}
	// Don't show description for 'distance' as it's the default

	return descriptions;
}
