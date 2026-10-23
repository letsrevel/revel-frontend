import type { HoldResponseSchema } from '$lib/api/generated/types.gen';

/**
 * Guest seat-hold session token (#1072).
 *
 * The guest-hold session used to ride only on a SameSite=Lax cookie on the API
 * host, which is never stored or sent from a custom domain (cross-site). The
 * backend (#1180) now also returns the session as `guest_hold_token` on hold
 * responses and accepts it back as the `X-Guest-Hold` request header.
 *
 * The token is kept first-party: in memory plus per-tab `sessionStorage`. It
 * is only ever read/written in the browser (never on the server, where module
 * state would be shared across users). A cookie-only legacy session returns
 * `null`, which leaves the stored token (if any) untouched.
 */

export const GUEST_HOLD_HEADER = 'X-Guest-Hold';

const STORAGE_KEY = 'revel:guest-hold-token';

let memoryToken: string | null = null;

function hasWindow(): boolean {
	return typeof window !== 'undefined';
}

/** The stored guest-hold token, or null (server, or nothing stored). */
export function getGuestHoldToken(): string | null {
	if (!hasWindow()) return null;
	if (memoryToken) return memoryToken;
	try {
		const stored = window.sessionStorage.getItem(STORAGE_KEY);
		if (stored) {
			memoryToken = stored;
			return stored;
		}
	} catch {
		// Storage unavailable — memory only.
	}
	return null;
}

/** Store a token from a hold response. No-op on null/undefined/empty; otherwise replaces. */
export function rememberGuestHoldToken(value: string | null | undefined): void {
	if (!hasWindow() || !value) return;
	memoryToken = value;
	try {
		window.sessionStorage.setItem(STORAGE_KEY, value);
	} catch {
		// Storage unavailable — memory only.
	}
}

/** Forget the token (login, logout, consumed holds). */
export function clearGuestHoldToken(): void {
	memoryToken = null;
	if (!hasWindow()) return;
	try {
		window.sessionStorage.removeItem(STORAGE_KEY);
	} catch {
		// Nothing to clean up.
	}
}

/**
 * Pull `guest_hold_token` (`HoldResponseSchema`, backend #1180) out of a hold
 * response body and store it. The body comes from a cloned raw response in the
 * client interceptor (200 or 409, where the error body carries it too), so it
 * is `unknown` until checked at runtime.
 */
export function rememberGuestHoldTokenFrom(body: unknown): void {
	if (typeof body !== 'object' || body === null || !('guest_hold_token' in body)) return;
	const value = (body as Pick<HoldResponseSchema, 'guest_hold_token'>).guest_hold_token;
	if (typeof value === 'string') rememberGuestHoldToken(value);
}

/** Endpoints that accept `X-Guest-Hold` (backend #1180). */
const HEADER_PATHS: RegExp[] = [
	/\/api\/events\/[^/]+\/seating\/(availability|holds)(\/best-available)?$/,
	/\/api\/events\/[^/]+\/(tickets\/[^/]+\/)?checkout\/public$/,
	/\/api\/events\/[^/]+\/rsvp\/[^/]+\/public$/,
	/\/api\/events\/guest-actions\/confirm$/
];

/** Endpoints whose response bodies (incl. errors) may carry `guest_hold_token`. */
const TOKEN_PATHS: RegExp[] = [/\/api\/events\/[^/]+\/seating\/holds(\/best-available)?$/];

function pathnameOf(url: string): string | null {
	try {
		return new URL(url).pathname;
	} catch {
		return null;
	}
}

/**
 * Add `X-Guest-Hold` when a token is stored, the caller is anonymous and the
 * endpoint is one that accepts it. Returns the (mutated) request.
 */
export function applyGuestHoldHeader(request: Request, isAnonymous: boolean): Request {
	if (!isAnonymous) return request;
	const token = getGuestHoldToken();
	if (!token) return request;
	const path = pathnameOf(request.url);
	if (path && HEADER_PATHS.some((re) => re.test(path))) {
		request.headers.set(GUEST_HOLD_HEADER, token);
	}
	return request;
}

/** Response hook: store a token returned by a hold / best-available call (200 or 409). */
export async function captureGuestHoldToken(response: Response, request: Request): Promise<void> {
	if (request.method !== 'POST') return;
	const path = pathnameOf(request.url);
	if (!path || !TOKEN_PATHS.some((re) => re.test(path))) return;
	try {
		rememberGuestHoldTokenFrom(await response.clone().json());
	} catch {
		// Non-JSON body — nothing to capture.
	}
}
