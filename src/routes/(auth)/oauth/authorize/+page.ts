import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

// CSR only: the access token lives in memory and the decision POST must never
// be a form action. The `(auth)` group's server guard still redirects
// anonymous users to /login?returnUrl=<this path + query> before the shell
// is served.
export const ssr = false;

export const load: PageLoad = async ({ parent }) => {
	const { features } = await parent();
	// Fail-closed flag: without a signing key every /api/oauth/* route 404s too.
	if (!features.oauth_provider) error(404, 'Not found');
};
