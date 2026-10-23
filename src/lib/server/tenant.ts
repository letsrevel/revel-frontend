import type { Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { organizationGetOrganizationByDomain } from '$lib/api/generated/sdk.gen';
import type { TenantOrganizationSchema } from '$lib/api/generated/types.gen';
import { log } from '$lib/server/logger';

/**
 * Tenant mode (#1055): serve an organization on its own custom domain.
 *
 * A request whose host is not one of the platform hosts is a tenant candidate.
 * The host is resolved to an organization via the public, anonymous
 * `GET /api/organizations/by-domain/{hostname}` endpoint and exposed as
 * `event.locals.tenant`. Unknown hosts get a bare 404 so a stray domain pointed
 * at this server never renders Revel pages.
 *
 * Deploy-safe: tenant mode is OFF until `PLATFORM_HOSTS` is set.
 */

export type TenantOrganization = TenantOrganizationSchema;

export type TenantResolution =
	| { status: 'found'; tenant: TenantOrganization }
	| { status: 'unknown' }
	| { status: 'unavailable' };

const POSITIVE_TTL_MS = 60_000;
const NEGATIVE_TTL_MS = 15_000;
const MAX_CACHE_ENTRIES = 500;
const LOOKUP_TIMEOUT_MS = 3_000;
const UNAVAILABLE_LOG_INTERVAL_MS = 10_000;

/** Always platform: loopback names (container HEALTHCHECK hits localhost:3000). */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/** Lowercase a Host value and strip the port (and a trailing root dot). */
export function normalizeHost(raw: string): string {
	let host = raw.trim().toLowerCase();
	if (host.startsWith('[')) {
		const end = host.indexOf(']');
		host = end === -1 ? host : host.slice(0, end + 1);
	} else {
		const colon = host.indexOf(':');
		if (colon !== -1) host = host.slice(0, colon);
	}
	return host.replace(/\.$/, '');
}

let parsedFrom: string | undefined;
let parsedHosts = new Set<string>();

function platformHosts(): Set<string> {
	const raw = env.PLATFORM_HOSTS ?? '';
	if (raw !== parsedFrom) {
		parsedFrom = raw;
		parsedHosts = new Set(
			raw
				.split(',')
				.map((h) => normalizeHost(h))
				.filter(Boolean)
		);
	}
	return parsedHosts;
}

/** True when the host belongs to the platform itself (not a tenant candidate). */
export function isPlatformHost(rawHost: string): boolean {
	const hosts = platformHosts();
	if (hosts.size === 0) return true; // tenant mode off
	const host = normalizeHost(rawHost);
	return LOOPBACK_HOSTS.has(host) || hosts.has(host);
}

interface CacheEntry {
	result: TenantResolution;
	expiry: number;
}

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<TenantResolution>>();
let lastUnavailableLog = 0;

/** Test-only: clear cache, in-flight lookups and log throttle. */
export function __resetTenantCache(): void {
	cache.clear();
	inFlight.clear();
	lastUnavailableLog = 0;
	parsedFrom = undefined;
}

function remember(host: string, result: TenantResolution, ttl: number): void {
	cache.delete(host); // re-insert so Map order tracks age
	cache.set(host, { result, expiry: Date.now() + ttl });
	while (cache.size > MAX_CACHE_ENTRIES) {
		const oldest = cache.keys().next().value;
		if (oldest === undefined) break;
		cache.delete(oldest);
	}
}

/** The ONE call to the by-domain endpoint (`fetch` is `event.fetch`, so handleFetch forwards client IP and request id). */
async function fetchTenant(
	host: string,
	fetch: typeof globalThis.fetch
): Promise<TenantResolution> {
	try {
		const res = await organizationGetOrganizationByDomain({
			fetch,
			path: { hostname: host },
			signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS)
		});
		if (res.response?.status === 404) return { status: 'unknown' };
		if (res.error !== undefined || !res.data?.id) return { status: 'unavailable' };
		return { status: 'found', tenant: res.data };
	} catch {
		return { status: 'unavailable' };
	}
}

/**
 * Resolve a tenant host to its organization. Cached per process (positive 60 s,
 * negative 15 s); upstream failures are never cached; concurrent lookups for
 * the same host share one request.
 */
export async function resolveTenant(
	rawHost: string,
	fetch: typeof globalThis.fetch
): Promise<TenantResolution> {
	const host = normalizeHost(rawHost);
	// Anything that isn't a plausible DNS name can't be a registered domain.
	if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(host)) return { status: 'unknown' };

	const hit = cache.get(host);
	if (hit) {
		if (hit.expiry > Date.now()) return hit.result;
		cache.delete(host);
	}

	const pending = inFlight.get(host);
	if (pending) return pending;

	const lookup = fetchTenant(host, fetch)
		.then((result) => {
			if (result.status === 'found') remember(host, result, POSITIVE_TTL_MS);
			else if (result.status === 'unknown') remember(host, result, NEGATIVE_TTL_MS);
			return result;
		})
		.finally(() => inFlight.delete(host));
	inFlight.set(host, lookup);
	return lookup;
}

/** Sets `locals.tenant`; 404 for unknown tenant hosts, 503 when the lookup fails. */
export const handleTenant: Handle = async ({ event, resolve }) => {
	if (isPlatformHost(event.url.host)) {
		event.locals.tenant = null;
		return resolve(event);
	}

	const result = await resolveTenant(event.url.host, event.fetch);
	if (result.status === 'found') {
		event.locals.tenant = result.tenant;
		return resolve(event);
	}
	if (result.status === 'unknown') {
		log.debug('tenant_host_unknown', { host: normalizeHost(event.url.host) });
		return new Response('Not found', { status: 404 });
	}
	const now = Date.now();
	if (now - lastUnavailableLog >= UNAVAILABLE_LOG_INTERVAL_MS) {
		lastUnavailableLog = now;
		log.warning('tenant_lookup_unavailable', { host: normalizeHost(event.url.host) });
	}
	return new Response('Service temporarily unavailable', {
		status: 503,
		headers: { 'retry-after': '5' }
	});
};
