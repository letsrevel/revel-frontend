import { error } from '@sveltejs/kit';
import { getSupportEmail } from '$lib/server/features';
import type { PageServerLoad } from './$types';

// Custom domains talk exclusively to owner-only backend endpoints, and exist
// only for organizations a platform superuser enabled them for.
//   - not the owner  -> 403 (same as billing / integrations)
//   - not enabled    -> the page renders a "request it" state with the support
//                       address from /version, and never mounts the manager
//                       (whose every call would be refused)
export const load: PageServerLoad = async ({ parent, fetch }) => {
	const { isOwner, organization } = await parent();

	if (!isOwner) {
		throw error(403, 'Only the organization owner can manage the custom domain.');
	}
	if (!organization.custom_domain_enabled) {
		return { customDomainEnabled: false, supportEmail: await getSupportEmail(fetch) };
	}

	return { customDomainEnabled: true, supportEmail: null };
};
