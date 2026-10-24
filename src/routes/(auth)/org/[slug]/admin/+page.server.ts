import {
	eventpublicdiscoveryListEvents,
	organizationadminmembershiprequestsListMembershipRequests
} from '$lib/api/generated/sdk.gen';
import type { EventInListSchema } from '$lib/api/generated/types.gen';
import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { log } from '$lib/server/logger';

const DAY_MS = 24 * 60 * 60 * 1000;

export const load: PageServerLoad = async ({ parent, locals, fetch, params }) => {
	const { organization } = await parent();
	const user = locals.user;

	if (!user) {
		throw error(401, 'You must be logged in to view the dashboard');
	}

	const headers: HeadersInit = {
		Authorization: `Bearer ${user.accessToken}`
	};

	// The backend's default `next_events` filter is `start >= now`, which would drop an
	// event that is running right now. Query from 24h back and filter on `end` client-side.
	const startAfter = new Date(Date.now() - DAY_MS).toISOString();

	const [eventsResult, requestsResult] = await Promise.all([
		eventpublicdiscoveryListEvents({
			fetch,
			headers,
			query: {
				organization: organization.id,
				include_past: true,
				start_after: startAfter,
				order_by: 'start',
				page_size: 12
			}
		}).catch((err: unknown) => ({ data: undefined, error: err })),
		organizationadminmembershiprequestsListMembershipRequests({
			fetch,
			headers,
			path: { slug: params.slug },
			query: { status: 'pending', page_size: 1 }
		}).catch((err: unknown) => ({ data: undefined, error: err }))
	]);

	let dashboardEvents: EventInListSchema[] = [];
	if (eventsResult.error || !eventsResult.data) {
		log.error('admin_dashboard_events_failed', {
			error: eventsResult.error,
			orgId: organization.id
		});
	} else {
		dashboardEvents = eventsResult.data.results ?? [];
	}

	// Staff without the member permission get a 403: hide the row rather than fail.
	const pendingRequestCount: number | null =
		requestsResult.error || !requestsResult.data ? null : requestsResult.data.count;

	return { dashboardEvents, pendingRequestCount };
};
