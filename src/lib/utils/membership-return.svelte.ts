import { page } from '$app/state';
import { safeReturnUrl } from '$lib/utils/safe-redirect';

/**
 * The sanitized `?returnUrl=` of the current page (where a membership applicant
 * came from, e.g. a members-only event), or `null` when absent or unsafe.
 *
 * The one place this query param is read and sanitized: call it inside a
 * `$derived`/template so it follows navigation.
 */
export function membershipReturnUrl(): string | null {
	return safeReturnUrl(page.url.searchParams.get('returnUrl'), '') || null;
}

/** True when `url` points at an event page (the only target worded "the event"). */
export function isEventReturnUrl(url: string | null | undefined): url is string {
	return !!url && url.startsWith('/events/');
}
