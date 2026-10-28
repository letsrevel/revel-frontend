import { applyServerAcceptEncoding } from '$lib/api/encoding';
import { API_BASE_URL } from '$lib/config/api';

/**
 * Tell the backend which custom domain a server-side API call is made on
 * behalf of (#1070). The backend validates `Origin` against active tenant
 * domains (as its dynamic CORS does) and, for account emails, adds
 * `return_host` to the platform links so users can come back afterwards.
 *
 * Only applies while serving a tenant host and only to API requests; an Origin
 * already on the request wins.
 */
export function forwardTenantOrigin(
	event: { locals: { tenant?: unknown }; url: URL },
	request: Request,
	isApi: boolean
): void {
	if (!isApi || !event.locals.tenant) return;
	if (request.headers.has('origin')) return;
	request.headers.set('origin', event.url.origin);
}

/**
 * Per-request header prep shared by every `handleFetch` path. Returns whether
 * the request targets the backend API.
 */
export function prepareApiRequest(
	event: { locals: { tenant?: unknown }; url: URL },
	request: Request
): boolean {
	const isApi = request.url.startsWith(API_BASE_URL);
	if (isApi) applyServerAcceptEncoding(request); // Node can't decode zstd
	forwardTenantOrigin(event, request, isApi);
	return isApi;
}
