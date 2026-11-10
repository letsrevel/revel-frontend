/**
 * Transient-failure classification for the auth store's follow-up fetches
 * (`/api/account/me`, `/api/permissions/my-permissions`) (#1207).
 *
 * A token refresh that succeeded proves the session is alive. If the user or
 * permissions fetch then fails with a throttle (429), a server error (5xx) or a
 * network error, the session must be KEPT and the fetch retried; only a 401 (or
 * any other definitive client error) ends it.
 */

/** Longest wait between hydration retries, and the cap on a server Retry-After. */
export const MAX_RETRY_DELAY_MS = 60_000;

/** Floor for any retry delay, so `Retry-After: 0` can't hot-loop. */
export const MIN_RETRY_DELAY_MS = 1_000;

/** Backoff ladder (ms) used when the server gives no Retry-After. Stays at the last rung. */
const BACKOFF_MS = [2_000, 5_000, 15_000, 30_000, MAX_RETRY_DELAY_MS] as const;

/**
 * A failed user/permissions fetch, carrying the HTTP status when there was a
 * response. The hey-api client never rejects on a network failure: it returns
 * `{ error: TypeError, response: undefined }`, which surfaces here as an
 * `AuthFetchError` with `status === undefined` and the original error as `cause`.
 */
export class AuthFetchError extends Error {
	readonly status: number | undefined;
	readonly retryAfterMs: number | undefined;

	constructor(message: string, response?: Response, cause?: unknown) {
		super(message, { cause });
		this.name = 'AuthFetchError';
		this.status = response?.status;
		this.retryAfterMs = parseRetryAfter(response?.headers?.get('Retry-After') ?? null);
	}
}

/** Parse a Retry-After header given in seconds (HTTP-date form is not used by the API). */
export function parseRetryAfter(value: string | null): number | undefined {
	if (value === null || value.trim() === '') return undefined;
	const seconds = Number(value);
	if (!Number.isFinite(seconds) || seconds < 0) return undefined;
	return Math.min(Math.max(seconds * 1000, MIN_RETRY_DELAY_MS), MAX_RETRY_DELAY_MS);
}

/**
 * True for failures that say nothing about session validity: no response at all
 * (network error), 429 or 5xx. Any other error (including a bare TypeError, which
 * is a programming bug) is not transient.
 */
export function isTransientAuthError(error: unknown): boolean {
	if (!(error instanceof AuthFetchError)) return false;
	const { status } = error;
	return status === undefined || status === 429 || status >= 500;
}

/** Delay before retry number `attempt` (0-based); Retry-After wins when present. */
export function hydrationRetryDelay(attempt: number, retryAfterMs?: number): number {
	if (retryAfterMs !== undefined) return retryAfterMs;
	return BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
}
