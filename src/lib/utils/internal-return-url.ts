import { page } from '$app/state';
import { safeReturnUrl } from '$lib/utils/safe-redirect';

/** Query param a questionnaire page adds to the return URL (`done` | `pending`). */
export const QUESTIONNAIRE_RETURN_PARAM = 'questionnaire';

/**
 * The sanitized `?returnUrl=` of the current page (where the visitor came from,
 * e.g. a members-only event or a series pass), or `null` when absent or unsafe.
 *
 * Same-origin paths only (see `safeReturnUrl`). The one place this query param
 * is read: call it inside a `$derived`/template so it follows navigation.
 */
export function safeInternalReturnUrl(): string | null {
	return safeReturnUrl(page.url.searchParams.get('returnUrl'), '') || null;
}

/** True when `url` points at an event page (the only target worded "the event"). */
export function isEventReturnUrl(url: string | null | undefined): url is string {
	return !!url && url.startsWith('/events/');
}

function pathnameOf(url: string): string {
	// Normalizes `..` segments, so `/events/../login` is judged as `/login`.
	return new URL(url, 'http://localhost').pathname;
}

/** Pages a pass questionnaire may return to: event/series pages and the passes dashboard. */
export function isPassFlowReturnTarget(url: string | null | undefined): url is string {
	if (!url) return false;
	const path = pathnameOf(url);
	return path.startsWith('/events/') || path === '/dashboard/passes';
}

/** True when the return target is a series page or the passes dashboard (worded "the pass"). */
export function isPassPageReturnTarget(url: string | null | undefined): boolean {
	if (!isPassFlowReturnTarget(url)) return false;
	const path = pathnameOf(url);
	return path === '/dashboard/passes' || /^\/events\/[^/]+\/series\//.test(path);
}

/** The current `?returnUrl=`, restricted to the pages a pass questionnaire may return to. */
export function passQuestionnaireReturnUrl(): string | null {
	const url = safeInternalReturnUrl();
	return isPassFlowReturnTarget(url) ? url : null;
}

/** `path` (with optional query/hash) with `key=value` set, merged into any existing query. */
export function withSearchParam(path: string, key: string, value: string): string {
	const url = new URL(path, 'http://localhost');
	url.searchParams.set(key, value);
	return url.pathname + url.search + url.hash;
}

/**
 * The page the visitor is on (path + query), as a `returnUrl` for a flow that
 * sends them away and back. The one-shot `questionnaire=` signal is dropped so
 * it never rides along into the next round trip.
 */
export function currentPageReturnPath(): string {
	const url = new URL(page.url);
	url.searchParams.delete(QUESTIONNAIRE_RETURN_PARAM);
	return url.pathname + url.search;
}
