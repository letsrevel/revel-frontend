import { z } from 'zod';
import {
	eventpublicdiscoveryListEvents,
	organizationadminticketsTicketAttributionBreakdown
} from '$lib/api/generated/sdk.gen';
import type { TicketAttributionBucketSchema } from '$lib/api/generated/types.gen';
import type { PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { extractErrorMessage } from '$lib/utils/errors';
import { log } from '$lib/server/logger';
import { shouldRedirectToSingle, sortTicketEventsForPicker } from '$lib/utils/ticket-event-picker';

export const load: PageServerLoad = async ({ parent, params, locals, fetch, url }) => {
	const { organization } = await parent();
	const user = locals.user;

	if (!user) {
		throw error(401, 'You must be logged in to manage tickets');
	}

	const headers: HeadersInit = {
		Authorization: `Bearer ${user.accessToken}`
	};

	const eventsResponse = await eventpublicdiscoveryListEvents({
		fetch,
		headers,
		query: {
			organization: organization.id,
			requires_ticket: true,
			include_past: true,
			next_events: false,
			page_size: 100
		}
	});

	if (eventsResponse.error) {
		log.error('admin_tickets_events_load_failed', {
			error: eventsResponse.error,
			orgId: organization.id
		});
		const errorMessage = extractErrorMessage(
			eventsResponse.error,
			'Failed to load ticketed events. Please try again later.'
		);
		throw error(500, errorMessage);
	}

	const events = eventsResponse.data?.results ?? [];

	// Convenience: jump straight to the only ticketed event when it's active.
	const single = shouldRedirectToSingle(events);
	if (single) {
		throw redirect(303, `/org/${params.slug}/admin/events/${single.id}/tickets`);
	}

	// Org-wide "Sales by source" filters (#880 follow-up), URL-param driven.
	// `since` is untrusted input — only kept when it parses as a real date.
	// `event_ids` is filtered to UUID-shaped values; the backend ignores ids
	// that don't belong to this org anyway, so there's nothing to intersect.
	const sinceParam = url.searchParams.get('since');
	const since =
		sinceParam !== null && Number.isFinite(new Date(sinceParam).getTime()) ? sinceParam : null;
	const eventIds = url.searchParams
		.getAll('event_ids')
		.filter((id) => z.string().uuid().safeParse(id).success);

	const attributionBreakdown: TicketAttributionBucketSchema[] | null =
		await organizationadminticketsTicketAttributionBreakdown({
			fetch,
			path: { slug: organization.slug },
			query: {
				since: since ?? undefined,
				event_ids: eventIds.length > 0 ? eventIds : undefined
			},
			headers
		})
			.then((res) => res.data ?? null)
			.catch((err) => {
				log.error('org_attribution_breakdown_load_failed', {
					error: err,
					orgId: organization.id
				});
				return null;
			});

	return {
		events: sortTicketEventsForPicker(events),
		attributionBreakdown,
		since,
		eventIds
	};
};
