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

/** Backoff ladder (ms) used when the server gives no Retry-After. */
const BACKOFF_MS = [2_000, 5_000, 15_000, 30_000, MAX_RETRY_DELAY_MS] as const;

/** Retries after the initial failure before we stop scheduling more. */
export const MAX_HYDRATION_RETRIES = 6;

/** A failed user/permissions fetch, carrying the HTTP status when there was a response. */
export class AuthFetchError extends Error {
	readonly status: number | undefined;
	readonly retryAfterMs: number | undefined;

	constructor(message: string, response?: Response) {
		super(message);
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
	return Math.min(seconds * 1000, MAX_RETRY_DELAY_MS);
}

/** True for failures that say nothing about session validity: 429, 5xx, network errors. */
export function isTransientAuthError(error: unknown): boolean {
	if (error instanceof AuthFetchError) {
		const { status } = error;
		return status !== undefined && (status === 429 || status >= 500);
	}
	// fetch() rejects with a TypeError on network failure / blocked request.
	return error instanceof TypeError;
}

/** Delay before retry number `attempt` (0-based); Retry-After wins when present. */
export function hydrationRetryDelay(attempt: number, retryAfterMs?: number): number {
	if (retryAfterMs !== undefined) return retryAfterMs;
	return BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
}
