/**
 * The timezone the backend uses to interpret "members on date" days for an
 * organization: the org's city timezone, else the platform default.
 * (`events.utils.get_organization_timezone`, `settings.TIME_ZONE`.)
 */
export const PLATFORM_DEFAULT_TIMEZONE = 'Europe/Vienna';

interface OrgWithCity {
	/**
	 * `CitySchema` does not expose `timezone` yet (backend gap: only id, name,
	 * country, admin_name). Typed as optional so the label starts naming the
	 * zone the moment the API adds it, with no change here.
	 */
	city?: { name?: string; timezone?: string | null } | null;
}

/**
 * IANA name of the organization's timezone, or `null` when it cannot be known
 * from the API (the org has a city but the city's timezone is not exposed).
 * Callers show a generic "organization's timezone" label for `null` rather
 * than naming a zone that may be wrong.
 */
export function resolveOrgTimezone(org: OrgWithCity | null | undefined): string | null {
	const city = org?.city;
	if (!city) return PLATFORM_DEFAULT_TIMEZONE;
	return typeof city.timezone === 'string' && city.timezone.trim() ? city.timezone : null;
}
