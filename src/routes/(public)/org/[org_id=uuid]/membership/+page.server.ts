import { redirect } from '@sveltejs/kit';
import { organizationGetOrganizationById } from '$lib/api';
import { log } from '$lib/server/logger';
import type { PageServerLoad } from './$types';

/**
 * Opaque Stripe-return route (#756, backend #849): membership subscription
 * success/cancel URLs carry the org UUID instead of its slug. Resolve with
 * the caller's SSR auth and 303 to the canonical membership page, query
 * string forwarded verbatim (membership_success/membership_cancelled). Any
 * failure — including the 410 the by-id endpoint shares with the token
 * route — sends the visitor to `/`, never an error page after a payment.
 */
export const load: PageServerLoad = async ({ params, locals, fetch, url }) => {
	const headers: HeadersInit = {};
	if (locals.user?.accessToken) {
		headers['Authorization'] = `Bearer ${locals.user.accessToken}`;
	}

	let target = '/';
	try {
		const { data } = await organizationGetOrganizationById({
			fetch,
			path: { organization_id: params.org_id },
			headers
		});
		if (data) {
			target = `/org/${data.slug}/membership${url.search}`;
		}
	} catch (err) {
		log.warning('uuid_org_resolve_failed', { error: err, orgId: params.org_id });
	}
	redirect(303, target);
};
