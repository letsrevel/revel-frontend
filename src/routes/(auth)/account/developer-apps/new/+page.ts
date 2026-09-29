import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

// CSR only, like every OAuth surface: the access token lives in memory.
export const ssr = false;

export const load: PageLoad = async ({ parent }) => {
	const { features } = await parent();
	// Fail-closed flag: every /api/oauth/* route 404s without a signing key.
	if (!features.oauth_provider) error(404, 'Not found');
};
