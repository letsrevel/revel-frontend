import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { organizationGetOrganization, eventpublicdiscoveryListEvents } from '$lib/api';
import { parseEmbedListFilters } from '$lib/embed/params';
import { loadEmbedPrices } from '$lib/server/embed-data';
import { log } from '$lib/server/logger';

/**
 * Filtered event list for one organization.
 *
 * The organization record is fetched for its own sake — the embed renders the
 * org's name, logo and outbound link from it, and an unknown slug has to become
 * a 404 rather than silently render someone else's events. Because we hold that
 * record anyway, the event query filters on `organization` (the id we already
 * have) rather than on a slug: it costs no additional request, and it cannot
 * degrade into an unfiltered, cross-organization list if the filter name is
 * ever unrecognised by the backend (Django Ninja drops unknown query params
 * silently, which on an embed would mean leaking every org's events onto a
 * customer's website).
 */
export const load: PageServerLoad = async ({ params, url, fetch }) => {
	const { org_slug } = params;
	const filters = parseEmbedListFilters(url.searchParams);

	const orgResponse = await organizationGetOrganization({ fetch, path: { slug: org_slug } });
	const organization = orgResponse.data;
	if (!organization) {
		// A transient backend failure and a genuinely unknown slug both end up as
		// the same 404 for the visitor; log the difference so we can tell them
		// apart when an organizer reports a blank embed.
		if (orgResponse.error) {
			log.warning('embed_organization_fetch_failed', {
				error: orgResponse.error,
				orgSlug: org_slug
			});
		}
		error(404, 'Organization not found');
	}

	const eventsResponse = await eventpublicdiscoveryListEvents({
		fetch,
		query: {
			organization: organization.id,
			tags: filters.tags,
			city_id: filters.cityId,
			event_type: filters.eventType,
			event_series: filters.eventSeries,
			include_past: filters.includePast,
			order_by: filters.orderBy,
			page: 1,
			page_size: filters.pageSize
		}
	});

	if (eventsResponse.error) {
		// An embed that renders "no events" is far better than one that renders a
		// stack trace inside someone else's page.
		log.warning('embed_events_fetch_failed', { error: eventsResponse.error, orgSlug: org_slug });
	}

	const events = eventsResponse.data?.results ?? [];

	return {
		organization,
		events,
		prices: await loadEmbedPrices(fetch, events)
	};
};
