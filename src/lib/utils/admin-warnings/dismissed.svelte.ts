/**
 * Per-browser dismissal of Info-level admin warnings (#1314).
 *
 * One localStorage key holds a JSON map `{ "<entityId>:<warningId>": true }`.
 * Entity ids are UUIDs, so they are unique across organizations; the map holds
 * no token and no personal data. A dismissal stays until storage is cleared.
 *
 * SSR safety: the state is module-level, but it is only ever written in the
 * browser (`loadDismissed` and `dismissWarning` are no-ops without `window`),
 * so a server render always sees the empty map and never shares data between
 * requests. Components call `loadDismissed()` after mount, never during render,
 * so hydration matches the server HTML.
 */
export const DISMISSED_STORAGE_KEY = 'revel:admin-warnings:dismissed';

let dismissed = $state<Record<string, true>>({});
let loaded = false;

function keyOf(entityId: string, warningId: string): string {
	return `${entityId}:${warningId}`;
}

function hasWindow(): boolean {
	return typeof window !== 'undefined';
}

/** Reads the map from localStorage once per page load. Safe to call many times. */
export function loadDismissed(): void {
	if (loaded || !hasWindow()) return;
	loaded = true;
	try {
		const raw = window.localStorage.getItem(DISMISSED_STORAGE_KEY);
		if (!raw) return;
		const parsed: unknown = JSON.parse(raw);
		if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
			const next: Record<string, true> = {};
			for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
				if (v === true) next[k] = true;
			}
			dismissed = next;
		}
	} catch {
		// Private mode, quota or a corrupt value: start with nothing dismissed.
	}
}

export function isWarningDismissed(entityId: string, warningId: string): boolean {
	return dismissed[keyOf(entityId, warningId)] === true;
}

export function dismissWarning(entityId: string, warningId: string): void {
	if (!hasWindow()) return;
	dismissed = { ...dismissed, [keyOf(entityId, warningId)]: true };
	try {
		window.localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(dismissed));
	} catch {
		// Storage unavailable: the dismissal lasts for this page load only.
	}
}

/** Test helper: forget the in-memory state so the next `loadDismissed` reads storage again. */
export function resetDismissedForTests(): void {
	dismissed = {};
	loaded = false;
}
