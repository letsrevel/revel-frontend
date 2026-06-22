import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

// Hybrid rendering (the default for authenticated admin pages): the shell +
// 403 guard render on the server, and the financials data is fetched
// client-side via TanStack Query (auth is attached by the client interceptor).
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
