import { error } from '@sveltejs/kit';

/**
 * The API client resolves HTTP errors instead of throwing, so a throttled
 * (429) or failing (5xx) backend looks exactly like "no data" to an SSR
 * loader — and most public loaders map "no data" to a 404. That tells a
 * merely rate-limited visitor (and every crawler) that a live page does not
 * exist (#890). Call this before concluding 404/410 from an empty response:
 * it turns transient upstream failures into a 503 "try again in a moment"
 * page and returns normally for everything else.
 */
export function throwIfTransientUpstream(response: Response | undefined): void {
	const status = response?.status;
	if (status === 429 || (typeof status === 'number' && status >= 500)) {
		throw error(503, 'Service temporarily unavailable — please try again in a moment.');
	}
}
