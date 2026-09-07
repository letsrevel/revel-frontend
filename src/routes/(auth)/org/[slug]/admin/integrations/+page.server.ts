import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { organizationintegrationsListIntegrations } from '$lib/api/generated';
import type { ConnectionSchema } from '$lib/api/generated/types.gen';
import { log } from '$lib/server/logger';

// Integrations holds OAuth grants for the organization: owner-only on the
// backend, so guard the page like billing does rather than render a shell
// whose every call 403s.
export const load: PageServerLoad = async ({ parent, locals, fetch }) => {
	const { isOwner, organization } = await parent();
	if (!isOwner) {
		throw error(403, 'Only the organization owner can manage integrations.');
	}
	const accessToken = locals.user?.accessToken;
	if (!accessToken) {
		throw error(401, 'You must be logged in to access this page');
	}

	// One row per provider this instance has credentials for, connected or not.
	// An empty list means no provider is enabled, which the page explains.
	const res = await organizationintegrationsListIntegrations({
		fetch,
		path: { slug: organization.slug },
		headers: { Authorization: `Bearer ${accessToken}` }
	});
	if (res.error || !res.data) {
		log.error('org_integrations_list_failed', { slug: organization.slug, error: res.error });
		throw error(500, 'Failed to load integrations');
	}
	const connections: ConnectionSchema[] = res.data;
	return { connections };
};
