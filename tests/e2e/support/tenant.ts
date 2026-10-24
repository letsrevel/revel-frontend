import http from 'node:http';
import type { Browser, BrowserContext, Page } from '@playwright/test';
import { API_URL, fetchWithRetry } from './api';
import { authenticateContext, type Credentials } from './session';
import type { PersonaName } from './personas';

/**
 * Custom-domain (tenant) helpers for j30-custom-domains.
 *
 * Backend: DEBUG-only seeds from `bootstrap_test_events` create two dedicated
 * tenant fixtures, both owned by `tenant.owner@example.com`: `tenant-test-org`
 * (domain `tenant.localhost`, events `tenant-rsvp-event` and
 * `tenant-free-ticket-event`) and `tenant-paid-org` (domain `paid.localhost`,
 * event `tenant-paid-event`, platform Stripe account). Both origins are allowed
 * through dynamic CORS. The shared fixtures carry no domains.
 * Frontend: tenant mode needs `PLATFORM_HOSTS`, and platform links / 301s land on
 * the served tenant host via `PUBLIC_CUSTOM_DOMAIN_URL_TEMPLATE` (both set by
 * playwright.config.ts).
 *
 * Chromium resolves `*.localhost` to loopback natively, so the browser reaches
 * `http://tenant.localhost:5173` with no host mapping. Node's resolver is not
 * guaranteed to, so every NON-browser request here connects to `localhost:5173`
 * and sets the tenant in the `Host` header instead (see {@link hostRequest}).
 */

export const FRONTEND_PORT = 5173;
export const FRONTEND_ORIGIN = `http://localhost:${FRONTEND_PORT}`;

export const TENANT_HOST = 'tenant.localhost';
export const TENANT_ORG_SLUG = 'tenant-test-org';
export const TENANT_ORIGIN = `http://${TENANT_HOST}:${FRONTEND_PORT}`;
/** Seeded: +30 days, RSVP-only, no tiers. */
export const TENANT_RSVP_EVENT_PATH = `/events/${TENANT_ORG_SLUG}/tenant-rsvp-event`;
/** Seeded: +31 days, tier "Free Ticket" (FREE, qty 100). */
export const TENANT_FREE_EVENT_PATH = `/events/${TENANT_ORG_SLUG}/tenant-free-ticket-event`;
/** Seeded branding of `tenant-test-org`. */

export const PAID_HOST = 'paid.localhost';
export const PAID_ORG_SLUG = 'tenant-paid-org';
export const PAID_ORIGIN = `http://${PAID_HOST}:${FRONTEND_PORT}`;
/** Seeded: +32 days, tier "Standard Ticket" (ONLINE, 10.00 EUR, qty 100). */
export const PAID_EVENT_PATH = `/events/${PAID_ORG_SLUG}/tenant-paid-event`;

/**
 * Seeded only for the session-revocation spec: it flips this org's
 * `custom_domain_enabled` kill switch, which would take every other spec's
 * tenant host down with it while it is off.
 */
export const REVOKE_HOST = 'revoke.localhost';
export const REVOKE_ORG_SLUG = 'tenant-revoke-org';
export const REVOKE_ORIGIN = `http://${REVOKE_HOST}:${FRONTEND_PORT}`;

/**
 * What the app builds for platform links to a custom domain. The e2e web server
 * sets `PUBLIC_CUSTOM_DOMAIN_URL_TEMPLATE=http://{hostname}:5173`, so these equal
 * the served origins (and following a link works).
 */
export const TENANT_CANONICAL_ORIGIN = TENANT_ORIGIN;
export const PAID_CANONICAL_ORIGIN = PAID_ORIGIN;

/** The subset of `TenantOrganizationSchema` the specs read. */
export interface TenantOrgInfo {
	id: string;
	slug: string;
	name: string;
	custom_domain?: string | null;
	has_membership_plans?: boolean;
	accept_membership_requests?: boolean;
	has_resources?: boolean;
	/** Server-adjusted per-mode colors (`#RRGGBB`), null when the org has no branding. */
	brand_theme?: { light: { primary: string }; dark: { primary: string } } | null;
}

/** `GET /api/organizations/by-domain/{hostname}`; null on 404 or any failure. */
export async function fetchTenantOrg(hostname: string): Promise<TenantOrgInfo | null> {
	try {
		const response = await fetchWithRetry(
			`${API_URL}/api/organizations/by-domain/${encodeURIComponent(hostname)}`,
			{ signal: AbortSignal.timeout(10_000) }
		);
		if (!response.ok) return null;
		return (await response.json()) as TenantOrgInfo;
	} catch {
		return null;
	}
}

export interface RawResponse {
	status: number;
	location: string | null;
	body: string;
}

/**
 * One raw HTTP request to the frontend server as `host`, WITHOUT following
 * redirects, so specs can assert status + Location verbatim. Connects to
 * `localhost:5173` and sends `Host: <host>:5173` (no DNS for `*.localhost`).
 * `host: null` is the platform itself (`Host: localhost:5173`).
 */
export function hostRequest(host: string | null, path: string): Promise<RawResponse> {
	return new Promise((resolve, reject) => {
		const req = http.request(
			{
				host: 'localhost',
				port: FRONTEND_PORT,
				path,
				method: 'GET',
				headers: host ? { host: `${host}:${FRONTEND_PORT}` } : {},
				timeout: 30_000
			},
			(res) => {
				const chunks: Buffer[] = [];
				res.on('data', (chunk: Buffer) => chunks.push(chunk));
				res.on('end', () =>
					resolve({
						status: res.statusCode ?? 0,
						location: typeof res.headers.location === 'string' ? res.headers.location : null,
						body: Buffer.concat(chunks).toString('utf8')
					})
				);
			}
		);
		req.on('timeout', () => req.destroy(new Error(`timeout: GET ${host ?? 'localhost'}${path}`)));
		req.on('error', reject);
		req.end();
	});
}

const probes = new Map<string, Promise<string | null>>();

/**
 * Why tenant specs cannot run (null when they can). Cached per worker.
 *
 * - the backend must resolve `hostname` (backend #1161 + its DEBUG tenant fixtures);
 * - when `needsTenantMode`, the frontend must also be serving it as a tenant
 *   (i.e. started with `PLATFORM_HOSTS`; a reused server without it renders the
 *   platform landing page on `tenant.localhost`).
 */
export function tenantUnavailableReason(
	hostname: string,
	{ needsTenantMode }: { needsTenantMode: boolean }
): Promise<string | null> {
	const key = `${hostname}|${needsTenantMode}`;
	let probe = probes.get(key);
	if (!probe) {
		probe = (async () => {
			const org = await fetchTenantOrg(hostname);
			if (!org) {
				return (
					`GET ${API_URL}/api/organizations/by-domain/${hostname} is not 200 — the backend ` +
					'needs revel-backend #1161 and `bootstrap_test_events` run under DEBUG, see tests/e2e/README.md'
				);
			}
			if (!needsTenantMode) return null;
			try {
				const home = await hostRequest(hostname, '/');
				if (home.status === 200 && home.body.includes(org.name)) return null;
				return (
					`${hostname} is not served as a tenant by the frontend on :${FRONTEND_PORT} ` +
					`(got ${home.status}) — start it with PLATFORM_HOSTS=localhost, see tests/e2e/README.md`
				);
			} catch (error) {
				return `frontend unreachable on :${FRONTEND_PORT}: ${String(error)}`;
			}
		})();
		probes.set(key, probe);
	}
	return probe;
}

/**
 * A fresh context whose relative URLs resolve against `origin`, optionally
 * authenticated (cookies planted for that host only — see authenticateContext).
 * The caller owns the context (`page.context().close()`).
 */
export async function tenantContext(
	browser: Browser,
	origin: string,
	who?: PersonaName | Credentials
): Promise<BrowserContext> {
	const context = await browser.newContext({ baseURL: origin });
	if (who) await authenticateContext(context, who, new URL(origin).hostname);
	return context;
}

export async function tenantPage(
	browser: Browser,
	origin: string,
	who?: PersonaName | Credentials
): Promise<Page> {
	return (await tenantContext(browser, origin, who)).newPage();
}
