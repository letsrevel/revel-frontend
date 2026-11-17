import * as m from '$lib/paraglide/messages.js';
import {
	eventpublicdiscoveryListEvents,
	organizationadminmembershiprequestsListMembershipRequests,
	organizationadminsubscriptionsListSubscriptions
} from '$lib/api/generated/sdk.gen';
import type { EventInListSchema } from '$lib/api/generated/types.gen';
import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { log } from '$lib/server/logger';
import { loadHasPublishedEvent, loadSetupCounts } from '$lib/server/org-setup';
import { setupHiddenCookieName } from '$lib/utils/org-setup-hidden-cookie';

const DAY_MS = 24 * 60 * 60 * 1000;
// The backend has no end-based filter, so "running now" is found by looking back this far
// for events that already started. An event running longer than this is not surfaced as live.
const LIVE_LOOKBACK_DAYS = 14;
// Pending subscriptions fetched to count the offline ones. Past this many the exact offline
// count is unknowable without a server filter, so the pending total is shown instead.
const PENDING_SUBS_PAGE_SIZE = 100;

export const load: PageServerLoad = async ({ parent, locals, fetch, params, cookies }) => {
	const { organization, isOwner } = await parent();
	const user = locals.user;

	if (!user) {
		throw error(401, m['serverErrors.admin.loginRequiredDashboard']());
	}

	const accessToken = user.accessToken ?? '';
	const headers: HeadersInit = {
		Authorization: `Bearer ${accessToken}`
	};

	// Owner collapsed the setup card: run only a minimal published check (below) instead of
	// the full counts; SSR renders the collapsed line unless an event is already published.
	const hiddenCookie = isOwner && cookies.get(setupHiddenCookieName(organization.id)) === '1';

	const now = Date.now();
	const nowIso = new Date(now).toISOString();
	const lookbackIso = new Date(now - LIVE_LOOKBACK_DAYS * DAY_MS).toISOString();
	const fail = (err: unknown) => ({ data: undefined, error: err });
	const base = { fetch, headers } as const;

	const [
		liveResult,
		upcomingResult,
		draftsResult,
		requestsResult,
		pendingSubsResult,
		setupCounts,
		hasPublished
	] = await Promise.all([
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
		}).catch(fail),
		// Pending subscriptions: the list has no plan-method filter, so offline ones are
		// counted client-side (see `countAwaitingPayment`).
		organizationadminsubscriptionsListSubscriptions({
			...base,
			path: { slug: params.slug },
			query: { status: 'pending', page_size: PENDING_SUBS_PAGE_SIZE }
		}).catch(fail),
		// Owners only: feeds the setup card. Never throws.
		isOwner && !hiddenCookie
			? loadSetupCounts({ orgId: organization.id, accessToken, fetch })
			: Promise.resolve(null),
		// Hidden: the collapsed line is only worth keeping while nothing is published.
		hiddenCookie
			? loadHasPublishedEvent({ orgId: organization.id, accessToken, fetch })
			: Promise.resolve(null)
	]);

	// Published already: the card no longer applies, so drop the stale cookie too.
	const published = hiddenCookie && hasPublished === true;
	if (published) cookies.delete(setupHiddenCookieName(organization.id), { path: '/' });
	const setupHidden = hiddenCookie && !published;

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

	// PENDING subscriptions on OFFLINE plans: people waiting on a first payment (awaiting
	// members, legacy rows, upgrading free members). Null (hidden) on error or no permission.
	let awaitingPaymentCount: number | null = null;
	if (pendingSubsResult.data) {
		const { count, results } = pendingSubsResult.data;
		awaitingPaymentCount =
			count > results.length
				? count
				: results.filter((s) => s.plan.payment_method === 'offline').length;
	}

	return {
		dashboardEvents,
		draftCount,
		pendingRequestCount,
		awaitingPaymentCount,
		setupCounts,
		setupHidden
	};
};
