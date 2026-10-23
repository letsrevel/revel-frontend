import { redirect } from '@sveltejs/kit';

/** A DNS-ish hostname; refuses anything that could turn the redirect into another origin. */
const HOSTNAME_RE = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i;

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
	const domain = org.custom_domain?.trim();
	if (!domain || !HOSTNAME_RE.test(domain)) return null;
	return `https://${domain.toLowerCase()}${url.pathname}${url.search}`;
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
