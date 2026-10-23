import { redirect } from '@sveltejs/kit';
import { eventseriesGetEventSeries } from '$lib/api';
import { log } from '$lib/server/logger';
import { tenantReturnUrl } from '$lib/server/tenant-canonical';
import type { PageServerLoad } from './$types';

/**
 * Opaque Stripe-return route (#756, backend #849) — series twin of the event
 * UUID route one directory up; see that load's comment for the full story,
 * including the first-step cross-host 303 to the org's custom domain.
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
		const { data, response } = await eventseriesGetEventSeries({
			fetch,
			path: { series_id: params.series_id },
			headers
		});
		if (data) {
			target = `/events/${data.organization.slug}/series/${data.slug}${url.search}`;
		} else {
			// The client doesn't throw on HTTP errors — log the 404/410 path too,
			// or a buyer bounced to `/` after paying leaves no trace.
			log.warning('uuid_series_resolve_failed', {
				status: response?.status,
				seriesId: params.series_id
			});
		}
	} catch (err) {
		log.warning('uuid_series_resolve_failed', { error: err, seriesId: params.series_id });
	}
	redirect(303, target);
};
