import { redirect } from '@sveltejs/kit';

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
