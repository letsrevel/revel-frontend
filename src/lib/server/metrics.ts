/**
 * Prometheus metrics for the SvelteKit Node server.
 *
 * Exposes a private `/metrics` endpoint on an internal-only port (default 9091)
 * served by a standalone `node:http` listener — Caddy never routes to it, so it
 * is reachable on the docker network only. The listener starts as a side effect
 * the first time this module is imported by the server hooks, guarded so dev/HMR
 * and tests never double-bind the port.
 *
 * Cardinality discipline mirrors the backend: metrics are labelled by the
 * SvelteKit route **id** (e.g. `/(public)/login`), never the raw request path,
 * so an attacker hitting random URLs can't explode the label set.
 */
import {
	Registry,
	Counter,
	Histogram,
	collectDefaultMetrics,
	type Registry as RegistryType
} from 'prom-client';
import { createServer, type Server } from 'node:http';
import { log } from './logger';

export const register: RegistryType = new Registry();

collectDefaultMetrics({ register });

export const httpRequestsTotal = new Counter({
	name: 'frontend_http_requests_total',
	help: 'Total SvelteKit HTTP requests handled by the Node server.',
	labelNames: ['method', 'status', 'route'] as const,
	registers: [register]
});

export const httpRequestDurationSeconds = new Histogram({
	name: 'frontend_http_request_duration_seconds',
	help: 'SvelteKit HTTP request duration in seconds.',
	labelNames: ['method', 'route'] as const,
	// Web-request latency buckets: sub-100ms SSR up to slow upstream calls.
	buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
	registers: [register]
});

export const ssrErrorsTotal = new Counter({
	name: 'frontend_ssr_errors_total',
	help: 'Total unhandled SSR errors caught by the SvelteKit handleError hook.',
	labelNames: ['route'] as const,
	registers: [register]
});

/** Fallback label when SvelteKit could not resolve a route id (e.g. 404s). */
const UNKNOWN_ROUTE = 'unknown';

/** Record a finished HTTP request. Never throws into the request path. */
export function recordRequest(args: {
	method: string;
	status: number;
	route: string | null;
	durationSeconds: number;
}): void {
	try {
		const route = args.route ?? UNKNOWN_ROUTE;
		httpRequestsTotal.inc({ method: args.method, status: String(args.status), route });
		httpRequestDurationSeconds.observe({ method: args.method, route }, args.durationSeconds);
	} catch {
		// Metrics must never break the response path.
	}
}

/** Record an unhandled SSR error. Never throws into the request path. */
export function recordSsrError(route: string | null): void {
	try {
		ssrErrorsTotal.inc({ route: route ?? UNKNOWN_ROUTE });
	} catch {
		// Metrics must never break the response path.
	}
}

const METRICS_PORT = Number(process.env.METRICS_PORT ?? 9091);

/**
 * Singleton guard. Stored on globalThis so adapter-node module re-evaluation
 * (and dev HMR, were it ever enabled) cannot bind the port twice.
 */
const GUARD = Symbol.for('revel.frontend.metricsServer');
type GuardedGlobal = typeof globalThis & { [GUARD]?: Server };

/**
 * Start the internal metrics listener. Idempotent and side-effect-safe:
 * - skipped under Vitest (no port binding in unit tests),
 * - skipped unless NODE_ENV==='production' (dev runs under Vite, not adapter-node),
 * - skipped if already bound (HMR / double-import),
 * - opt-out via ENABLE_METRICS=false.
 */
export function startMetricsServer(): Server | undefined {
	if (process.env.VITEST) return undefined;
	if (process.env.NODE_ENV !== 'production') return undefined;
	if (process.env.ENABLE_METRICS === 'false') return undefined;

	const g = globalThis as GuardedGlobal;
	if (g[GUARD]) return g[GUARD];

	const server = createServer(async (req, res) => {
		if (req.url !== '/metrics') {
			res.statusCode = 404;
			res.end('Not Found');
			return;
		}
		try {
			const body = await register.metrics();
			res.setHeader('Content-Type', register.contentType);
			res.end(body);
		} catch (error) {
			res.statusCode = 500;
			res.end('Error collecting metrics');
			log.error('metrics_scrape_failed', { error });
		}
	});

	server.on('error', (error) => {
		// Don't crash the app if the metrics port is unavailable.
		log.error('metrics_server_error', { error, port: METRICS_PORT });
	});

	server.listen(METRICS_PORT, () => {
		log.info('metrics_server_listening', { port: METRICS_PORT });
	});

	g[GUARD] = server;
	return server;
}
