import { getBackendUrl } from '$lib/config/api';
import { siteName, themeColor, type SeoTenant } from './tenant';

/** Web app manifest names are truncated by launchers well before this. */
const SHORT_NAME_MAX = 12;

interface ManifestIcon {
	src: string;
	sizes: string;
	purpose: string;
}

/**
 * Icons from the org logo: the 150x150 thumbnail the backend generates, and the
 * original logo, whose real size is unknown (`any`). Absolute media URLs.
 */
function tenantIcons(tenant: SeoTenant): ManifestIcon[] {
	const icons: ManifestIcon[] = [];
	if (tenant.logo_thumbnail_url) {
		icons.push({ src: getBackendUrl(tenant.logo_thumbnail_url), sizes: '150x150', purpose: 'any' });
	}
	if (tenant.logo) {
		icons.push({ src: getBackendUrl(tenant.logo), sizes: 'any', purpose: 'any' });
	}
	return icons;
}

/** The org's web app manifest on a tenant host (#1057). */
export function tenantManifest(tenant: SeoTenant): Record<string, unknown> {
	const name = siteName(tenant);
	const color = themeColor(tenant);
	return {
		name,
		short_name: name.length > SHORT_NAME_MAX ? `${name.slice(0, SHORT_NAME_MAX - 1)}…` : name,
		start_url: '/',
		scope: '/',
		display: 'standalone',
		background_color: '#ffffff',
		theme_color: color,
		icons: tenantIcons(tenant)
	};
}
