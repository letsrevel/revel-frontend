import http from 'node:http';
import type { Browser, BrowserContext, Page } from '@playwright/test';
import { API_URL, fetchWithRetry } from './api';
import { authenticateContext, type Credentials } from './session';
import type { PersonaName } from './personas';

/**
 * Custom-domain (tenant) helpers for j30-custom-domains.
 *
 * Backend: DEBUG-only seeds from `bootstrap_test_events` (revel-backend #1161)
 * map `tenant.localhost` to `eligibility-test-org` and `alpha.localhost` to
 * `revel-events-collective`, and allow those two origins through dynamic CORS.
 * Frontend: tenant mode needs `PLATFORM_HOSTS` (playwright.config.ts sets it).
 *
 * Chromium resolves `*.localhost` to loopback natively, so the browser reaches
 * `http://tenant.localhost:5173` with no host mapping. Node's resolver is not
 * guaranteed to, so every NON-browser request here connects to `localhost:5173`
 * and sets the tenant in the `Host` header instead (see {@link hostRequest}).
 */

export const FRONTEND_PORT = 5173;
export const FRONTEND_ORIGIN = `http://localhost:${FRONTEND_PORT}`;

export const TENANT_HOST = 'tenant.localhost';
export const TENANT_ORG_SLUG = 'eligibility-test-org';
export const TENANT_ORIGIN = `http://${TENANT_HOST}:${FRONTEND_PORT}`;

export const ALPHA_HOST = 'alpha.localhost';
export const ALPHA_ORG_SLUG = 'revel-events-collective';
export const ALPHA_ORIGIN = `http://${ALPHA_HOST}:${FRONTEND_PORT}`;

/** What the app builds for platform links to a custom domain: https, no port. */
export const TENANT_CANONICAL_ORIGIN = `https://${TENANT_HOST}`;
export const ALPHA_CANONICAL_ORIGIN = `https://${ALPHA_HOST}`;

/** The subset of `TenantOrganizationSchema` the specs read. */
export interface TenantOrgInfo {
	id: string;
	slug: string;
	name: string;
	custom_domain?: string | null;
	has_membership_plans?: boolean;
	accept_membership_requests?: boolean;
	has_resources?: boolean;
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
 * - the backend must resolve `hostname` (backend #1161 + its DEBUG seed);
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
