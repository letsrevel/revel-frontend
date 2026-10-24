import type { TenantOrganizationSchema } from '$lib/api/generated/types.gen';
import { getBackendUrl } from '$lib/config/api';
import { SITE_NAME } from './constants';

/**
 * Tenant-aware SEO helpers (#1057).
 *
 * On a custom-domain host the "site" is the organization, not Revel: titles,
 * `og:site_name`, the manifest, favicon and theme color all follow it. Every
 * helper takes the tenant as `null | undefined` for the platform host and
 * returns exactly what the platform emitted before tenant mode existed.
 */

export type SeoTenant = TenantOrganizationSchema;

/** Revel's own theme color (Hearty Purple), used on the platform and as the tenant fallback. */
export const REVEL_THEME_COLOR = '#8C3CDD';

const HEX_COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** The ONE place the site name is chosen: the org on a tenant host, "Revel" otherwise. */
export function siteName(tenant?: SeoTenant | null): string {
	return tenant?.name?.trim() || SITE_NAME;
}

/**
 * `Title | Site`: `Title | Revel` on the platform, `Title | Org name` on a tenant
 * host. `separator` keeps the legacy `Title - Revel` pages byte-identical.
 */
export function withSiteName(title: string, tenant?: SeoTenant | null, separator = ' | '): string {
	return `${title}${separator}${siteName(tenant)}`;
}

/** `<meta name="theme-color">` / manifest `theme_color` for a request. */
export function themeColor(tenant?: SeoTenant | null): string {
	if (!tenant) return REVEL_THEME_COLOR;
	const primary = tenant.brand_theme?.light?.primary;
	return typeof primary === 'string' && HEX_COLOR_RE.test(primary) ? primary : REVEL_THEME_COLOR;
}

function absolute(path: string | null | undefined): string | undefined {
	return path ? getBackendUrl(path) : undefined;
}

/** Small square icon (favicon / apple-touch-icon): the org logo thumbnail, else the logo. */
export function tenantIconUrl(tenant?: SeoTenant | null): string | undefined {
	return absolute(tenant?.logo_thumbnail_url) ?? absolute(tenant?.logo);
}

/** Social-card image for pages with no better one: the org cover, else its logo. */
export function tenantShareImage(tenant?: SeoTenant | null): string | undefined {
	return (
		absolute(tenant?.cover_art_social_url) ?? absolute(tenant?.cover_art) ?? absolute(tenant?.logo)
	);
}

/**
 * The `{brand}` value for attendee-path i18n strings (#1059): the org name on a
 * tenant host, "Revel" elsewhere. Same choice as `siteName`, named for what the
 * message parameter means. Strings about the Revel *account*, privacy or legal
 * entity deliberately do not take it and keep a literal "Revel".
 */
export function brandName(tenant?: SeoTenant | null): string {
	return siteName(tenant);
}
