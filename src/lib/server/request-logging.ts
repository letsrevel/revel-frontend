/**
 * Request-logging and SSR-error hooks for the SvelteKit server.
 *
 * Kept in `$lib/server` (rather than inline in `hooks.server.ts`) so they depend
 * only on the logger and metrics modules and can be unit-tested without pulling
 * in `$env`, the generated API client, or i18n. `hooks.server.ts` wires them in.
 */
import type { Handle, HandleServerError } from '@sveltejs/kit';
import { log } from './logger';
import { recordRequest, recordSsrError } from './metrics';

/**
 * Request logging + metrics hook.
 *
 * Must be FIRST in the `sequence` so it wraps the entire chain and times the
 * full request lifecycle. Generates a per-request UUID (`request_id`), forwarded
 * upstream as `X-Request-ID` by handleFetch and echoed on the response, so a
 * single request's frontend and backend log lines correlate in Loki. Emits one
 * `request_finished` line per request and records the HTTP metrics.
 *
 * `user_id` is read AFTER `resolve` because handleAuth (later in the sequence)
 * populates `locals.user` during it. Everything after `resolve` is wrapped so
 * observability can never break the response path.
 */
export const handleRequestLogging: Handle = async ({ event, resolve }) => {
	event.locals.requestId = crypto.randomUUID();
	const start = performance.now();

	const response = await resolve(event);

	try {
		const durationMs = Math.round(performance.now() - start);
		const routeId = event.route.id;
		let ipAddress: string | undefined;
		try {
			ipAddress = event.getClientAddress();
		} catch {
			// getClientAddress() throws during prerendering — omit it.
		}

		response.headers.set('x-request-id', event.locals.requestId);

		recordRequest({
			method: event.request.method,
			status: response.status,
			route: routeId,
			durationSeconds: durationMs / 1000
		});

		log.info('request_finished', {
			method: event.request.method,
			path: event.url.pathname,
			route_id: routeId,
			status_code: response.status,
			duration_ms: durationMs,
			request_id: event.locals.requestId,
			user_id: event.locals.user?.id,
			ip_address: ipAddress,
			user_agent: event.request.headers.get('user-agent') ?? undefined
		});
	} catch {
		// Logging/metrics must never take the site down.
	}

	return response;
};

/**
 * Unhandled SSR error hook. SvelteKit calls this for any error thrown during
 * load/render/actions that it did not turn into an expected HttpError, AND for
 * unmatched routes (status 404). The returned shape becomes `$page.error` —
 * kept minimal so we never leak internals to the browser.
 *
 * Only genuine server faults (status >= 500) are logged at error level and
 * counted into the SSR error metric that `FrontendSSRErrors` alerts on. Client
 * errors (4xx — overwhelmingly 404s from bots probing `/*.php`, `/.env`,
 * `/.git/*`, …) are logged at warning WITHOUT touching the metric, so scanner
 * noise can never trip the alert. IP/UA are included so scans stay traceable.
 */
export const handleSsrError: HandleServerError = ({ error, event, status, message }) => {
	const routeId = event.route.id;
	let ipAddress: string | undefined;
	try {
		ipAddress = event.getClientAddress();
	} catch {
		// getClientAddress() throws during prerendering — omit it.
	}
	const context = {
		error,
		route_id: routeId,
		path: event.url.pathname,
		method: event.request.method,
		status_code: status,
		request_id: event.locals.requestId,
		ip_address: ipAddress,
		user_agent: event.request.headers.get('user-agent') ?? undefined
	};

	if (status < 500) {
		log.warning('ssr_client_error', context);
		return { message };
	}

	recordSsrError(routeId);
	log.error('unhandled_ssr_error', context);
	return { message };
};
