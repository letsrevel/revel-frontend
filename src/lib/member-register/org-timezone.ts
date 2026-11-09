/**
 * Fallback only: the zone the backend uses when an organization has no city
 * timezone (`events.utils.get_organization_timezone`, `settings.TIME_ZONE`).
 */
export const PLATFORM_DEFAULT_TIMEZONE = 'Europe/Vienna';

interface OrgWithTimezone {
	/** Resolved IANA name, always present on the org-admin detail schema. */
	timezone?: string | null;
}

/**
 * IANA name of the organization's timezone, read from the backend's resolved
 * `organization.timezone`. Falls back to the platform default only if the field
 * is absent (e.g. a stale API), so a zone is always named.
 */
export function resolveOrgTimezone(org: OrgWithTimezone | null | undefined): string {
	const tz = org?.timezone;
	return typeof tz === 'string' && tz.trim() ? tz : PLATFORM_DEFAULT_TIMEZONE;
}
