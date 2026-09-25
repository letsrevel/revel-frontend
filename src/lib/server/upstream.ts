import { error } from '@sveltejs/kit';
import { log, type LogFields } from './logger';

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

/** The parts of an API-client result that {@link throwIfUpstreamFailed} inspects. */
interface ApiResult {
	error?: unknown;
	response?: Response;
}

/**
 * For `+server.ts` proxy routes: if an API-client call did not succeed, log it
 * with the upstream status and error body, then throw an HttpError the browser
 * can act on. Upstream 4xx pass through unchanged (a backend 403 must reach the
 * UI as a 403 so it can say "no permission"); a 5xx, or no response at all,
 * becomes 502. Returns normally on a 2xx.
 *
 * Needed for the same reason as {@link throwIfTransientUpstream}: the client
 * resolves HTTP errors instead of throwing, so a `try/catch` around the call
 * never sees them and a bare `if (!data) throw error(500)` discards the status
 * and body — leaving Loki with nothing but "Failed to update potluck item".
 */
export function throwIfUpstreamFailed(
	event: string,
	result: ApiResult,
	message: string,
	fields: LogFields = {}
): void {
	const status = result.response?.status;
	if (status !== undefined && status >= 200 && status < 300) {
		return;
	}
	const context = { ...fields, upstream_status: status, upstream_error: result.error };
	if (status !== undefined && status >= 400 && status < 500) {
		log.warning(event, context);
		throw error(status, message);
	}
	log.error(event, context);
	throw error(502, message);
}
