/** Statuses a retry can never heal: auth needs user action, a permission or a missing resource stays that way. */
const NO_RETRY_STATUSES: ReadonlySet<number> = new Set([401, 403, 404]);

/** Retries after the first failure; TanStack only exposes `query.error` once they are spent. */
export const MAX_QUERY_RETRIES = 2;

/**
 * The global query `retry` predicate. An error carrying a `status` of 401, 403
 * or 404 fails immediately (so pages render their not-found / unverified state
 * without a multi-second backoff); anything else retries up to twice.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
	if (error && typeof error === 'object' && 'status' in error) {
		const { status } = error as { status: unknown };
		if (typeof status === 'number' && NO_RETRY_STATUSES.has(status)) return false;
	}
	return failureCount < MAX_QUERY_RETRIES;
}
