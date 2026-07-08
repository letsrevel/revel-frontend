import type { QueryClient } from '@tanstack/svelte-query';

// Canonical query-key vocabulary for series passes (buyer + organizer surfaces).
//
// Mirrors the conventions in `event-series.ts`: readonly tuples, one factory per
// surface, and helpers for the common invalidation patterns.

type SeriesId = string;
type PassId = string;

export const seriesPassQueryKeys = {
	// Root — blanket invalidation.
	all: ['series-passes'] as const,

	// Public: passes on sale for a series.
	list: (seriesId: SeriesId) => ['series-passes', 'list', seriesId] as const,

	// Public: live pro-rata quote for one pass.
	quote: (passId: PassId) => ['series-passes', 'quote', passId] as const,

	// Buyer: my held passes (paginated).
	minePrefix: ['series-passes', 'mine'] as const,
	mine: (page: number) => ['series-passes', 'mine', { page }] as const,

	// Organizer: passes configured on a series (admin schema, includes coverage).
	adminList: (seriesId: SeriesId) => ['series-passes', 'admin', seriesId] as const,

	// Organizer: holders of one pass (paginated, searchable).
	holders: (seriesId: SeriesId, passId: PassId, opts: { page?: number; search?: string } = {}) =>
		[
			'series-passes',
			'admin',
			seriesId,
			'holders',
			passId,
			{ page: opts.page ?? 1, search: opts.search ?? '' }
		] as const,
	holdersPrefix: (seriesId: SeriesId, passId: PassId) =>
		['series-passes', 'admin', seriesId, 'holders', passId] as const
} as const;

/** After organizer mutations (pass CRUD, tier links, confirm/cancel holders). */
export async function invalidateAdminPasses(
	queryClient: QueryClient,
	seriesId: SeriesId
): Promise<void> {
	await Promise.all([
		queryClient.invalidateQueries({ queryKey: seriesPassQueryKeys.adminList(seriesId) }),
		queryClient.invalidateQueries({
			queryKey: ['series-passes', 'admin', seriesId, 'holders'],
			exact: false
		}),
		// Public list/quote can change too (price, visibility, active flag).
		queryClient.invalidateQueries({ queryKey: seriesPassQueryKeys.list(seriesId) }),
		queryClient.invalidateQueries({ queryKey: ['series-passes', 'quote'], exact: false })
	]);
}

/** After a buyer purchase: refresh my passes and the quote/sold-out state. */
export async function invalidateAfterPurchase(
	queryClient: QueryClient,
	seriesId: SeriesId,
	passId: PassId
): Promise<void> {
	await Promise.all([
		queryClient.invalidateQueries({ queryKey: seriesPassQueryKeys.minePrefix, exact: false }),
		queryClient.invalidateQueries({ queryKey: seriesPassQueryKeys.quote(passId) }),
		queryClient.invalidateQueries({ queryKey: seriesPassQueryKeys.list(seriesId) })
	]);
}
