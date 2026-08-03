import { redirect } from '@sveltejs/kit';
import { eventseriesGetEventSeries } from '$lib/api';
import { log } from '$lib/server/logger';
import type { PageServerLoad } from './$types';

/**
 * Opaque Stripe-return route (#756, backend #849) — series twin of the event
 * UUID route one directory up; see that load's comment for the full story.
 */
export const load: PageServerLoad = async ({ params, locals, fetch, url }) => {
	const headers: HeadersInit = {};
	if (locals.user?.accessToken) {
		headers['Authorization'] = `Bearer ${locals.user.accessToken}`;
	}

	let target = '/';
	try {
		const { data } = await eventseriesGetEventSeries({
			fetch,
			path: { series_id: params.series_id },
			headers
		});
		if (data) {
			target = `/events/${data.organization.slug}/series/${data.slug}${url.search}`;
		}
	} catch (err) {
		log.warning('uuid_series_resolve_failed', { error: err, seriesId: params.series_id });
	}
	redirect(303, target);
};
