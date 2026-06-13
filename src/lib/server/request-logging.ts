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
 * load/render/actions that it did not turn into an expected HttpError. Logs it
 * at error level with a stack and the request context, and increments the SSR
 * error metric that `FrontendSSRErrors` alerts on. The returned shape becomes
 * `$page.error` — kept minimal so we never leak internals to the browser.
 */
export const handleSsrError: HandleServerError = ({ error, event, status, message }) => {
	const routeId = event.route.id;
	recordSsrError(routeId);
	log.error('unhandled_ssr_error', {
		error,
		route_id: routeId,
		path: event.url.pathname,
		method: event.request.method,
		status_code: status,
		request_id: event.locals.requestId
	});
	return { message };
};
