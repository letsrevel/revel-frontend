import {
	eventpublicdiscoveryListEvents,
	organizationadminmembershiprequestsListMembershipRequests
} from '$lib/api/generated/sdk.gen';
import type { EventInListSchema } from '$lib/api/generated/types.gen';
import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { log } from '$lib/server/logger';

const DAY_MS = 24 * 60 * 60 * 1000;
// The backend has no end-based filter, so "running now" is found by looking back this far
// for events that already started. An event running longer than this is not surfaced as live.
const LIVE_LOOKBACK_DAYS = 14;

export const load: PageServerLoad = async ({ parent, locals, fetch, params }) => {
	const { organization } = await parent();
	const user = locals.user;

	if (!user) {
		throw error(401, 'You must be logged in to view the dashboard');
	}

	const headers: HeadersInit = {
		Authorization: `Bearer ${user.accessToken}`
	};

	const now = Date.now();
	const nowIso = new Date(now).toISOString();
	const lookbackIso = new Date(now - LIVE_LOOKBACK_DAYS * DAY_MS).toISOString();
	const fail = (err: unknown) => ({ data: undefined, error: err });
	const base = { fetch, headers } as const;

	const [liveResult, upcomingResult, draftsResult, requestsResult] = await Promise.all([
		// In-progress candidates: already started within the lookback window. The client keeps
		// those whose `end` is still in the future (the model does this filtering).
		eventpublicdiscoveryListEvents({
			...base,
			query: {
				organization: organization.id,
				include_past: true,
				start_after: lookbackIso,
				start_before: nowIso,
				order_by: '-start',
				page_size: 20
			}
		}).catch(fail),
		// Upcoming: without include_past the backend applies its default `start >= now`.
		eventpublicdiscoveryListEvents({
			...base,
			query: { organization: organization.id, order_by: 'start', page_size: 12 }
		}).catch(fail),
		// Drafts that have not started yet; only the total is needed.
		eventpublicdiscoveryListEvents({
			...base,
			query: { organization: organization.id, status: 'draft', page_size: 1 }
		}).catch(fail),
		organizationadminmembershiprequestsListMembershipRequests({
			...base,
			path: { slug: params.slug },
			query: { status: 'pending', page_size: 1 }
		}).catch(fail)
	]);

	const byId = new Map<string, EventInListSchema>();
	for (const [name, result] of [
		['live', liveResult],
		['upcoming', upcomingResult]
	] as const) {
		if (result.error || !result.data) {
			log.error('admin_dashboard_events_failed', {
				error: result.error,
				orgId: organization.id,
				query: name
			});
			continue;
		}
		for (const e of result.data.results ?? []) byId.set(e.id, e);
	}
	const dashboardEvents: EventInListSchema[] = [...byId.values()];

	// Null hides the drafts row instead of showing a wrong number.
	let draftCount: number | null = null;
	if (draftsResult.error || !draftsResult.data) {
		log.error('admin_dashboard_drafts_failed', {
			error: draftsResult.error,
			orgId: organization.id
		});
	} else {
		draftCount = draftsResult.data.count;
	}

	// Staff without the member permission get a 403: hide the row rather than fail.
	const pendingRequestCount: number | null =
		requestsResult.error || !requestsResult.data ? null : requestsResult.data.count;

	return { dashboardEvents, draftCount, pendingRequestCount };
};
