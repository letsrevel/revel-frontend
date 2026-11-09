interface OrgWithTimezone {
	/** Resolved IANA name from the org-admin detail schema. */
	timezone?: string | null;
}

/**
 * IANA name of the organization's timezone (the backend-resolved
 * `organization.timezone`), or `null` when it is missing or blank. Callers show
 * a generic "organization's timezone" label for `null` rather than naming a
 * zone that may be wrong.
 */
export function resolveOrgTimezone(org: OrgWithTimezone | null | undefined): string | null {
	const tz = org?.timezone;
	return typeof tz === 'string' && tz.trim() ? tz : null;
}
