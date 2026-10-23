import { redirect } from '@sveltejs/kit';
import { organizationGetOrganizationById } from '$lib/api';
import { log } from '$lib/server/logger';
import { tenantReturnUrl } from '$lib/server/tenant-canonical';
import type { PageServerLoad } from './$types';

/**
 * Opaque Stripe-return route (#756, backend #849): membership subscription
 * success/cancel URLs carry the org UUID instead of its slug. Resolve with
 * the caller's SSR auth and 303 to the canonical membership page, query
 * string forwarded verbatim (membership_success/membership_cancelled). Any
 * failure — including the 410 the by-id endpoint shares with the token
 * route — sends the visitor to `/`, never an error page after a payment.
 *
 * First step, tenant mode on: an org with a custom domain 303s to the same
 * path on that domain (the buyer's session cookies are host-only), where this
 * load runs again and does the slug redirect.
 */
export const load: PageServerLoad = async ({ params, locals, fetch, url }) => {
	// Custom-domain org: continue on its domain, where the buyer's session lives.
	const tenantHop = await tenantReturnUrl(locals, params.org_id, url, fetch);
	if (tenantHop) redirect(303, tenantHop);

	const headers: HeadersInit = {};
	if (locals.user?.accessToken) {
		headers['Authorization'] = `Bearer ${locals.user.accessToken}`;
	}

	let target = '/';
	try {
		const { data, response } = await organizationGetOrganizationById({
			fetch,
			path: { organization_id: params.org_id },
			headers
		});
		if (data) {
			target = `/org/${data.slug}/membership${url.search}`;
		} else {
			// The client doesn't throw on HTTP errors — log the 404/410 path too,
			// or a buyer bounced to `/` after paying leaves no trace.
			log.warning('uuid_org_resolve_failed', {
				status: response?.status,
				orgId: params.org_id
			});
		}
	} catch (err) {
		log.warning('uuid_org_resolve_failed', { error: err, orgId: params.org_id });
	}
	redirect(303, target);
};
