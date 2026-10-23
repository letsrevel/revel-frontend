/**
 * Links to an organization's attendee pages (#1056).
 *
 * An organization with an active custom domain is served at
 * its custom-domain origin (`https://{custom_domain}` by default, see {@link customDomainOrigin}). Wherever such an org is linked from the platform
 * (or from another tenant), link straight to that origin so there is no
 * redirect hop through the platform's 301. Admin routes stay on the platform and
 * must NOT go through `orgHref`.
 */

import { browser } from '$app/environment';
import { env } from '$env/dynamic/public';

const DEFAULT_TEMPLATE = 'https://{hostname}';
let warnedInvalidTemplate = false;

/**
 * The URL template for custom-domain origins: `PUBLIC_CUSTOM_DOMAIN_URL_TEMPLATE`
 * (runtime public env, so it works client-side too). Must start with `http://`
 * or `https://` and contain `{hostname}`; anything else falls back to
 * `https://{hostname}` (logged once, server-side only). Mirrors the backend's
 * `CUSTOM_DOMAIN_URL_TEMPLATE`; dev/E2E use `http://{hostname}:5173`.
 */
function customDomainTemplate(): string {
	const raw = env.PUBLIC_CUSTOM_DOMAIN_URL_TEMPLATE?.trim();
	if (!raw) return DEFAULT_TEMPLATE;
	if (/^https?:\/\//i.test(raw) && raw.includes('{hostname}')) return raw;
	if (!warnedInvalidTemplate && !browser) {
		warnedInvalidTemplate = true;
		console.warn(
			`[org-links] Invalid PUBLIC_CUSTOM_DOMAIN_URL_TEMPLATE; using ${DEFAULT_TEMPLATE}`
		);
	}
	return DEFAULT_TEMPLATE;
}

/**
 * Origin (no trailing slash) a custom domain is served at, per the configured
 * template, or `null` when `hostname` is absent or malformed.
 */
export function customDomainOrigin(hostname: string | null | undefined): string | null {
	const host = normalizeCustomDomain(hostname);
	return host ? customDomainTemplate().replaceAll('{hostname}', host).replace(/\/+$/, '') : null;
}

/** Minimal shape every generated org schema carrying a domain satisfies. */
export interface OrgWithDomain {
	custom_domain?: string | null;
}

// Dot-separated DNS labels: letters, digits, hyphen inside a label; at least
// one dot (a bare label is never a public custom domain). No scheme, slash,
// `@`, port, whitespace or underscore.
const HOSTNAME_RE =
	/^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/** Lowercased, validated custom domain, or `null` when absent or malformed. */
export function normalizeCustomDomain(domain: string | null | undefined): string | null {
	if (!domain) return null;
	const host = domain.trim().toLowerCase();
	return HOSTNAME_RE.test(host) ? host : null;
}

/** Custom-domain origin for an org with a valid domain, otherwise `null`. */
export function orgOrigin(org: OrgWithDomain | null | undefined): string | null {
	return customDomainOrigin(org?.custom_domain);
}

/**
 * `path` for the org's attendee pages: the plain relative path when the org has
 * no (valid) custom domain or we're already on it, else `https://{domain}{path}`.
 *
 * @param path                 Absolute app path (optionally with query/hash), e.g. `/events/acme/party`.
 * @param currentTenantDomain  `page.data.tenant?.custom_domain` (null on the platform host).
 */
export function orgHref(
	org: OrgWithDomain | null | undefined,
	path: string,
	currentTenantDomain?: string | null
): string {
	const host = normalizeCustomDomain(org?.custom_domain);
	if (!host) return path;
	// Compare hostnames, not origins: the template may add a port or scheme.
	if (normalizeCustomDomain(currentTenantDomain) === host) return path;
	return `${customDomainOrigin(host)}${rootRelative(path)}`;
}

/**
 * During SSR SvelteKit's `resolve()` returns PAGE-relative paths (`./events/x`,
 * `../../org/x`) because `paths.relative` defaults to true. Prefixing one with
 * an origin would yield `https://host./events/x`. The app has no base path, so
 * dropping the leading `./` / `../` segments gives the root-relative path.
 */
function rootRelative(path: string): string {
	const stripped = path.replace(/^(?:\.{1,2}(?:\/|$))+/, '');
	return stripped.startsWith('/') ? stripped : `/${stripped}`;
}

/** The current tenant's custom domain from root layout data (`page.data`). */
export function tenantDomainFrom(data: unknown): string | null {
	const tenant = (data as { tenant?: OrgWithDomain | null } | null | undefined)?.tenant;
	return tenant?.custom_domain ?? null;
}
