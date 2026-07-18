/**
 * Anonymous seat-hold registry.
 *
 * Anonymous buyers acquire seat holds identified by a signed httpOnly guest
 * cookie. When such a user logs in, those holds look FOREIGN to the authed
 * purchase (the backend prefers the authenticated identity whenever a Bearer
 * header is present) and would 409 the checkout. This module remembers which
 * events hold anonymous seats (sessionStorage) so login can release them.
 *
 * IDENTITY CRITICAL: `releaseAnonymousHolds()` must reach the backend WITHOUT
 * an Authorization header so the guest-cookie identity is the one releasing.
 * The generated SDK client injects the Bearer token via an interceptor, so we
 * deliberately use a raw `fetch` here — the guest cookie still rides along via
 * `credentials: 'include'`.
 */
import { API_BASE_URL } from '$lib/config/api';

const STORAGE_KEY = 'revel:anon-seat-holds';

function readRecord(): string[] {
	if (typeof window === 'undefined') return [];
	try {
		const raw = window.sessionStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((id): id is string => typeof id === 'string');
	} catch {
		return [];
	}
}

function writeRecord(eventIds: string[]): void {
	if (typeof window === 'undefined') return;
	try {
		if (eventIds.length === 0) {
			window.sessionStorage.removeItem(STORAGE_KEY);
		} else {
			window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(eventIds));
		}
	} catch {
		// Storage unavailable (private mode, quota) — holds simply expire server-side.
	}
}

/** Remember that the current (anonymous) browser holds seats for this event. */
export function recordAnonymousHold(eventId: string): void {
	const record = readRecord();
	if (record.includes(eventId)) return;
	writeRecord([...record, eventId]);
}

/** Forget the anonymous-hold record for one event (e.g. after releasing its holds). */
export function clearAnonymousHoldRecord(eventId: string): void {
	const record = readRecord();
	if (!record.includes(eventId)) return;
	writeRecord(record.filter((id) => id !== eventId));
}

/** Whether any event has recorded anonymous holds in this browser session. */
export function hasAnonymousHolds(): boolean {
	return readRecord().length > 0;
}

/**
 * Release every recorded anonymous hold (all seats per event), then clear the
 * record. Errors are swallowed — releasing is best-effort; unreleased holds
 * expire server-side within minutes. Safe to call with nothing recorded.
 */
export async function releaseAnonymousHolds(): Promise<void> {
	const eventIds = readRecord();
	if (eventIds.length === 0) return;
	try {
		await Promise.allSettled(
			eventIds.map((eventId) =>
				fetch(`${API_BASE_URL}/api/events/${eventId}/seating/holds`, {
					method: 'DELETE',
					// Guest-hold cookie rides along; NO Authorization header (see module doc).
					credentials: 'include'
				})
			)
		);
	} finally {
		writeRecord([]);
	}
}
