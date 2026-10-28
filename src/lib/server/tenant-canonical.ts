import { redirect } from '@sveltejs/kit';

import { organizationGetOrganizationCustomDomain } from '$lib/api';
import { customDomainOrigin, type LinkContext } from '$lib/utils/org-links';
import {
	isPlatformHost,
	normalizeHost,
	resolveTenant,
	tenantModeEnabled
} from '$lib/server/tenant';
import { platformOrigin } from '$lib/server/tenant-routing';

/** The link context for server code (SEO canonicals): same shape as the client's `page.data`. */
export function serverLinkContext(locals: App.Locals): LinkContext {
	const enabled = tenantModeEnabled();
	return {
		tenant: locals.tenant ?? null,
		customDomains: { enabled, platformOrigin: enabled ? platformOrigin() : null }
	};
}

/**
 * Where a page of `org` canonically lives: its custom domain, or null when
 * tenant mode is off, the org has none, we're already serving a tenant host, or
 * the domain equals the request host (a `custom_domain` misconfigured to a
 * platform host would otherwise 301 to itself).
 */
export function canonicalTenantUrl(
	locals: App.Locals,
	org: { custom_domain?: string | null },
	url: URL
): string | null {
	if (locals.tenant || !tenantModeEnabled()) return null;
	// customDomainOrigin validates the hostname, so the redirect can't leave the template's origin.
	const origin = customDomainOrigin(org.custom_domain);
	if (!origin) return null;
	if (new URL(origin).host === url.host) return null;
	return `${origin}${url.pathname}${url.search}`;
}

/**
 * Platform-host guard for org-scoped public pages (#1056): when the org is
 * served on its own domain, 301 there, keeping path and query string (Stripe
 * `payment_success`, `?ot=`, `?et=`, ...). No-op on tenant hosts and for orgs
 * without an active custom domain. Not for `/embed/*` (iframed on third-party
 * sites) or admin routes.
 */
export function canonicalTenantRedirect(
	locals: App.Locals,
	org: { custom_domain?: string | null },
	url: URL
): void {
	const target = canonicalTenantUrl(locals, org, url);
	if (target) redirect(301, target);
}

/**
 * Stripe-return hop (#1056; backend #1167 keeps Stripe success/cancel URLs on
 * the platform's UUID routes). On the platform host, when the org has a custom
 * domain, send the buyer to the SAME UUID path on that domain: their session
 * cookies are host-only and live there, so a private event or membership
 * resolves with their auth, and the tenant's own UUID route then 303s to the
 * slug page with the query string (payment_success, ...) intact. Null on
 * tenant hosts, for orgs without an active domain (404), and on any lookup
 * failure (the caller's existing flow takes over). Uses the dedicated public
 * custom-domain endpoint: the org retrieve 404s anonymously for private and
 * members-only orgs, and the buyer has no platform session here.
 */
export async function tenantReturnUrl(
	locals: App.Locals,
	orgId: string,
	url: URL,
	fetch: typeof globalThis.fetch
): Promise<string | null> {
	if (locals.tenant || !tenantModeEnabled()) return null;
	try {
		const { data } = await organizationGetOrganizationCustomDomain({
			fetch,
			path: { organization_id: orgId }
		});
		return data ? canonicalTenantUrl(locals, data, url) : null;
	} catch {
		return null;
	}
}

/** Where to send a user back to after a platform-hosted account flow (#1070). */
export interface ReturnTarget {
	/** Custom-domain origin, no trailing slash. Append a path; never a token or query. */
	origin: string;
	/** The organization's display name, for "Continue to {name}". */
	name: string;
}

// A bare DNS name only: no scheme, path, userinfo, port, query or whitespace.
const BARE_HOSTNAME = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i;

/**
 * Validate a `return_host` query value (appended by the backend to the account
 * emails' PLATFORM links when the request came from a custom domain, BE #1156).
 *
 * The link is attacker-craftable, so this is an allowlist, never an open
 * redirect: tenant mode must be on, the value must be a bare hostname, it must
 * not be a platform host, and it must resolve to an ACTIVE tenant. Anything
 * else (including a failed lookup) is null and the caller keeps its platform
 * flow. The origin comes from the configured URL template, not from the input.
 */
export async function resolveReturnTarget(
	rawHost: string | null | undefined,
	fetch: typeof globalThis.fetch
): Promise<ReturnTarget | null> {
	if (!rawHost || !tenantModeEnabled()) return null;
	if (!BARE_HOSTNAME.test(rawHost)) return null;
	const host = normalizeHost(rawHost);
	if (isPlatformHost(host)) return null;
	const result = await resolveTenant(host, fetch);
	if (result.status !== 'found') return null;
	const origin = customDomainOrigin(host);
	return origin ? { origin, name: result.tenant.name } : null;
}

/** {@link resolveReturnTarget}, origin only. */
export async function resolveReturnHost(
	rawHost: string | null | undefined,
	fetch: typeof globalThis.fetch
): Promise<string | null> {
	return (await resolveReturnTarget(rawHost, fetch))?.origin ?? null;
}
