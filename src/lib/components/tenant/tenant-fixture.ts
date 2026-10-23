import type { TenantOrganizationSchema } from '$lib/api/generated/types.gen';

export function makeTenant(
	overrides: Partial<TenantOrganizationSchema> = {}
): TenantOrganizationSchema {
	return {
		id: 'org-1',
		slug: 'acme',
		name: 'Acme Collective',
		description: null,
		logo: null,
		cover_art: null,
		logo_thumbnail_url: null,
		cover_art_thumbnail_url: null,
		cover_art_social_url: null,
		custom_domain: 'events.example.org',
		accept_membership_requests: false,
		has_membership_plans: false,
		has_resources: false,
		...overrides
	} as TenantOrganizationSchema;
}
