import { redirect } from '@sveltejs/kit';

import { organizationGetOrganizationCustomDomain } from '$lib/api';
import { customDomainOrigin } from '$lib/utils/org-links';

/**
 * Where a page of `org` canonically lives: its custom domain, or null when the
 * org has none (or we're already serving a tenant host).
 */
export function canonicalTenantUrl(
	locals: App.Locals,
	org: { custom_domain?: string | null },
	url: URL
): string | null {
	if (locals.tenant) return null;
	// customDomainOrigin validates the hostname, so the redirect can't leave the template's origin.
	const origin = customDomainOrigin(org.custom_domain);
	if (!origin) return null;
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
	if (locals.tenant) return null;
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
