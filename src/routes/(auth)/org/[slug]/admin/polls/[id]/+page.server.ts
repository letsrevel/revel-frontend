import { error } from '@sveltejs/kit';
import {
	pollGetPoll,
	eventpublicdiscoveryListEvents,
	organizationadminmembersListMembershipTiers
} from '$lib/api/generated/sdk.gen';
import { extractErrorMessage } from '$lib/utils/errors';
import { log } from '$lib/server/logger';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals, parent, fetch }) => {
	const user = locals.user;
	if (!user) throw error(401, 'Unauthorized');

	const { organization, isOwner } = await parent();

	const [pollRes, eventsRes, tiersRes] = await Promise.all([
		pollGetPoll({
			fetch,
			path: { poll_id: params.id },
			headers: { Authorization: `Bearer ${user.accessToken}` }
		}),
		eventpublicdiscoveryListEvents({
			fetch,
			// page_size max is 200 (backend cap). Covers orgs with up to 200
			// events so a poll scoped to any of them resolves its name in the
			// audience picker; beyond that the selected event would show blank.
			query: { organization: organization.id, page_size: 200 }
		}),
		organizationadminmembersListMembershipTiers({
			fetch,
			path: { slug: organization.slug },
			headers: { Authorization: `Bearer ${user.accessToken}` }
		})
	]);

	if (pollRes.error) {
		const status = pollRes.response?.status ?? 500;
		log.error('poll_load_failed', { status, error: pollRes.error });
		const message = extractErrorMessage(pollRes.error, 'Failed to load poll');
		throw error(status === 404 ? 404 : status >= 500 ? 500 : 502, message);
	}
	// The audience picker depends on these; surface a failure instead of
	// silently rendering an empty event/tier list (mirrors new/+page.server.ts).
	if (eventsRes.error) {
		const status = eventsRes.response?.status ?? 500;
		throw error(
			status >= 500 ? 500 : 502,
			extractErrorMessage(eventsRes.error, 'Failed to load events')
		);
	}
	if (tiersRes.error) {
		const status = tiersRes.response?.status ?? 500;
		throw error(
			status >= 500 ? 500 : 502,
			extractErrorMessage(tiersRes.error, 'Failed to load membership tiers')
		);
	}

	if (!pollRes.data) {
		throw error(500, 'Failed to load poll');
	}

	return {
		poll: pollRes.data,
		events: eventsRes.data?.results ?? [],
		tiers: tiersRes.data ?? [],
		isOwner
	};
};
