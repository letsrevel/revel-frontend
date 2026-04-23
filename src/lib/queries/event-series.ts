import type { QueryClient } from '@tanstack/svelte-query';

// Canonical query-key vocabulary for the event-series admin surface.
//
// Every mutating flow (create, template edit, recurrence edit, cancel, generate,
// pause/resume, bulk-cancel-drifted, settings) must invalidate the matching
// subset below. The helpers below encapsulate the common invalidation patterns.
//
// Keys are readonly tuples typed as `readonly unknown[]` to stay compatible with
// TanStack Query's generic query-key constraint while keeping autocomplete.

type Slug = string;
type SeriesId = string;

export const seriesQueryKeys = {
	// Root — useful for blanket invalidation during dev.
	all: ['event-series'] as const,

	// Public series detail (by id or by org+slug).
	detail: (seriesId: SeriesId) => ['event-series', 'detail', seriesId] as const,

	// Admin full recurrence detail (the new GET from backend PR #378).
	recurrenceDetail: (slug: Slug, seriesId: SeriesId) =>
		['event-series', 'admin', slug, seriesId, 'recurrence-detail'] as const,

	// Drift detection (the new drift GET from backend PR #378).
	drift: (slug: Slug, seriesId: SeriesId) =>
		['event-series', 'admin', slug, seriesId, 'drift'] as const,

	// Occurrences list filtered by series. `past` toggles past/upcoming bucket.
	occurrences: (seriesId: SeriesId, opts: { past?: boolean } = {}) =>
		['event-series', 'occurrences', seriesId, { past: opts.past ?? false }] as const
} as const;

// Convenience: after a mutation that can change any aspect of a series, blow
// away all admin caches for that series in one call. Components can still call
// the narrower invalidators when only one surface changed.
export async function invalidateSeries(
	queryClient: QueryClient,
	slug: Slug,
	seriesId: SeriesId
): Promise<void> {
	await Promise.all([
		queryClient.invalidateQueries({ queryKey: seriesQueryKeys.detail(seriesId) }),
		queryClient.invalidateQueries({
			queryKey: seriesQueryKeys.recurrenceDetail(slug, seriesId)
		}),
		queryClient.invalidateQueries({ queryKey: seriesQueryKeys.drift(slug, seriesId) }),
		queryClient.invalidateQueries({
			queryKey: ['event-series', 'occurrences', seriesId],
			exact: false
		})
	]);
}

// Narrower: only drift state changed (e.g. a recurrence edit that didn't touch
// template or occurrences). Drift banner re-renders on completion.
export async function invalidateDrift(
	queryClient: QueryClient,
	slug: Slug,
	seriesId: SeriesId
): Promise<void> {
	await queryClient.invalidateQueries({ queryKey: seriesQueryKeys.drift(slug, seriesId) });
}

// Narrower: a single occurrence was cancelled or created; refresh the list
// buckets and any detail-level aggregates (e.g. exdates count).
export async function invalidateOccurrences(
	queryClient: QueryClient,
	slug: Slug,
	seriesId: SeriesId
): Promise<void> {
	await Promise.all([
		queryClient.invalidateQueries({
			queryKey: ['event-series', 'occurrences', seriesId],
			exact: false
		}),
		queryClient.invalidateQueries({
			queryKey: seriesQueryKeys.recurrenceDetail(slug, seriesId)
		}),
		queryClient.invalidateQueries({ queryKey: seriesQueryKeys.drift(slug, seriesId) })
	]);
}
