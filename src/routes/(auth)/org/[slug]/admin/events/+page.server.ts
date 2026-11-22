import { eventpublicdiscoveryListEvents } from '$lib/api/generated/sdk.gen';
import { mergeEvents } from '$lib/utils/merge-events';
import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { extractErrorMessage } from '$lib/utils/errors';
import { log } from '$lib/server/logger';
import * as m from '$lib/paraglide/messages.js';

export const load: PageServerLoad = async ({ parent, locals, fetch }) => {
	const { organization, canCreateEvent } = await parent();
	const user = locals.user;

	if (!user) {
		throw error(401, m['serverErrors.adminEvents.loginToViewEvents']());
	}

	const headers: HeadersInit = {
		Authorization: `Bearer ${user.accessToken}`
	};

	// Two requests, so the page-size cap cannot drop the soonest upcoming events:
	// upcoming (start >= now) soonest first, and past (start < now) newest first.
	// The page groups and orders them (#1285). TODO: Add pagination.
	const base = { organization: organization.id, page_size: 100 }; // UUID, not slug
	const [upcomingResponse, pastResponse] = await Promise.all([
		eventpublicdiscoveryListEvents({
			fetch,
			headers,
			query: { ...base, include_past: false, next_events: true, order_by: 'start' }
		}),
		eventpublicdiscoveryListEvents({
			fetch,
			headers,
			query: { ...base, include_past: true, past_events: true, order_by: '-start' }
		})
	]);

	// Handle API errors
	for (const response of [upcomingResponse, pastResponse]) {
		if (response.error) {
			log.error('admin_events_load_failed', { error: response.error, orgId: organization.id });
			const errorMessage = extractErrorMessage(
				response.error,
				m['serverErrors.adminEvents.loadEventsRetryLater']()
			);
			throw error(500, errorMessage);
		}
		if (!response.data) {
			throw error(500, m['serverErrors.common.loadEventsFailed']());
		}
	}

	return {
		events: mergeEvents(upcomingResponse.data?.results, pastResponse.data?.results),
		canCreateEvent
	};
};
