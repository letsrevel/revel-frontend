import { createHash } from 'node:crypto';
import { tokenRefresh } from '$lib/api/generated';

/**
 * Single-flight, short-memory refresh-token rotation (#1191).
 *
 * The backend rotates the refresh token on every use and blacklists the old
 * one with NO reuse grace (SimpleJWT ROTATE_REFRESH_TOKENS +
 * BLACKLIST_AFTER_ROTATION). Two requests that present the same refresh cookie
 * R1 can therefore never both succeed, and the loser is told "Token is
 * blacklisted" even though the winner just minted a valid R2.
 *
 * That is exactly what a full page reload during a client refresh produces:
 *
 *   1. the client POSTs /api/auth/refresh with R1, the backend rotates to R2;
 *   2. the page unloads before R2's Set-Cookie is applied (or the reloaded
 *      document request, carrying R1, reaches hooks.server.ts first);
 *   3. the reload's refresh (SSR hook or the new page's client bootstrap)
 *      presents R1 again, is rejected as blacklisted, and the user is signed
 *      out. The Web Lock cannot help: it dies with the old document.
 *
 * Here every rotation of the same token, whether from the endpoint or from the
 * SSR hook, shares one backend call, and the successful result is remembered
 * for a short window so a request that arrives just AFTER the winner finished
 * is answered with the same R2 (and re-sets the cookie) instead of replaying
 * R1 at the backend. Failures are never remembered, so a genuinely dead token
 * still fails every time.
 *
 * The map is per Node process; a multi-replica deployment still needs the
 * backend-side reuse grace described in #1191 for cross-replica coverage.
 * Entries hold tokens in server memory only, for REPLAY_WINDOW_MS, and are
 * keyed by a hash of the old token.
 */
export const REPLAY_WINDOW_MS = 30_000;
const MAX_ENTRIES = 500;

type Raw = Awaited<ReturnType<typeof tokenRefresh>>;
/** The SDK's result union, widened so callers can destructure `error` uniformly. */
export type RotationResult = {
	data?: Extract<Raw, { data: unknown }>['data'];
	error?: unknown;
	response?: Response;
};

interface Entry {
	promise: Promise<RotationResult>;
	timer: ReturnType<typeof setTimeout> | undefined;
}

const entries = new Map<string, Entry>();

function keyOf(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

function evict(key: string): void {
	const entry = entries.get(key);
	if (entry?.timer) clearTimeout(entry.timer);
	entries.delete(key);
}

function usable(result: RotationResult): boolean {
	return !result.error && !!result.data?.access && !!result.data?.refresh;
}

/** Rotate `refreshToken`, sharing the backend call with concurrent/just-finished callers. */
export function rotateRefreshToken(
	refreshToken: string,
	fetchFn: typeof fetch
): Promise<RotationResult> {
	const key = keyOf(refreshToken);
	const existing = entries.get(key);
	if (existing) return existing.promise;

	if (entries.size >= MAX_ENTRIES) {
		const oldest = entries.keys().next().value;
		if (oldest !== undefined) evict(oldest);
	}

	const entry: Entry = {
		promise: tokenRefresh({
			body: { refresh: refreshToken },
			fetch: fetchFn
		}) as Promise<RotationResult>,
		timer: undefined
	};
	entries.set(key, entry);

	entry.promise.then(
		(result) => {
			if (!usable(result)) {
				if (entries.get(key) === entry) evict(key);
				return;
			}
			entry.timer = setTimeout(() => {
				if (entries.get(key) === entry) entries.delete(key);
			}, REPLAY_WINDOW_MS);
			// Never keep the process alive for a cache timer.
			entry.timer.unref?.();
		},
		() => {
			if (entries.get(key) === entry) evict(key);
		}
	);

	return entry.promise;
}

/** Test helper. */
export function resetRefreshRotation(): void {
	for (const key of [...entries.keys()]) evict(key);
}
