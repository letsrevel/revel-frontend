import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Custom domains talk exclusively to owner-only backend endpoints, and exist
// only for organizations a platform superuser enabled them for. The admin nav
// and dashboard hide the entry otherwise; this guards a direct URL so the page
// never renders a shell whose every call 403s.
//   - not the owner  -> 403 (same as billing / integrations)
//   - not enabled    -> 404 (the feature does not exist for this organization)
export const load: PageServerLoad = async ({ parent }) => {
	const { isOwner, organization } = await parent();

	if (!isOwner) {
		throw error(403, 'Only the organization owner can manage the custom domain.');
	}
	if (!organization.custom_domain_enabled) {
		throw error(404, 'Not found');
	}

	return {};
};
