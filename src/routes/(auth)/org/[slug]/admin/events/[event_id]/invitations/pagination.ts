/**
 * Pagination assembly helpers for the event invitations admin page loader.
 *
 * The loader fetches three independently-paginated lists (requests, registered
 * invitations, pending invitations) but only the active tab uses the requested
 * page/page-size; the inactive tabs fall back to page 1 / size 20. These pure
 * helpers build the pagination descriptors so that logic lives in one place.
 */

/** Pagination descriptor returned to the page for each list. */
export interface InvitationPagination {
	page: number;
	pageSize: number;
	totalCount: number;
	totalPages: number;
	hasNext: boolean;
	hasPrev: boolean;
}

/** The empty pagination used before a list has loaded (or if its fetch fails). */
export function defaultPagination(): InvitationPagination {
	return {
		page: 1,
		pageSize: 20,
		totalCount: 0,
		totalPages: 0,
		hasNext: false,
		hasPrev: false
	};
}

/**
 * Build the pagination descriptor for a list.
 *
 * @param isActiveTab - whether this list's tab is the active one (only then do
 *   the requested `page`/`pageSize` apply; otherwise page 1 / size 20 is used)
 * @param page - the requested page (from the query string)
 * @param pageSize - the requested page size (from the query string)
 * @param totalCount - total item count reported by the API
 */
export function computePagination(
	isActiveTab: boolean,
	page: number,
	pageSize: number,
	totalCount: number
): InvitationPagination {
	const effectivePage = isActiveTab ? page : 1;
	const effectivePageSize = isActiveTab ? pageSize : 20;
	const totalPages = Math.ceil(totalCount / effectivePageSize);
	return {
		page: effectivePage,
		pageSize: effectivePageSize,
		totalCount,
		totalPages,
		hasNext: effectivePage < totalPages,
		hasPrev: effectivePage > 1
	};
}
