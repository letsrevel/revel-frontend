import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { registerRedirectTarget } from '$lib/member-register/redirects';

// The standalone member register is retired: it is now the People tab of the
// Members area. Permanent redirect keeps old bookmarks and shared filter links
// working; the filter query is carried over (see `registerRedirectTarget`).
export const load: PageServerLoad = async ({ params, url }) => {
	throw redirect(301, registerRedirectTarget(params.slug, url.searchParams));
};
