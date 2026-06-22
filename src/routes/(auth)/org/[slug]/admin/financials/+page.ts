import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

// Financials is an interactive, owner-only admin surface with no SEO value, so it
// renders client-side and fetches via TanStack Query (auth is attached by the
// client interceptor).
export const ssr = false;

export const load: PageLoad = async ({ parent }) => {
	const { organization, isOwner } = await parent();

	// The revenue endpoints are guarded by `manage_organization`, which only
	// organization owners hold. Mirror that guard here so staff who deep-link the
	// page get a clear 403 instead of an empty API error.
	if (!isOwner) {
		throw error(403, 'You do not have permission to view organization financials.');
	}

	return { organization };
};
