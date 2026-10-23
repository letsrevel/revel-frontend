/**
 * Links to an organization's attendee pages (#1056).
 *
 * An organization with an active custom domain is served at
 * `https://{custom_domain}`. Wherever such an org is linked from the platform
 * (or from another tenant), link straight to that origin so there is no
 * redirect hop through the platform's 301. Admin routes stay on the platform and
 * must NOT go through `orgHref`.
 */

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

/** `https://{custom_domain}` for an org with a valid domain, otherwise `null`. */
export function orgOrigin(org: OrgWithDomain | null | undefined): string | null {
	const host = normalizeCustomDomain(org?.custom_domain);
	return host ? `https://${host}` : null;
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
	if (normalizeCustomDomain(currentTenantDomain) === host) return path;
	return `https://${host}${rootRelative(path)}`;
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
