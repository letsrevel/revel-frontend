import * as m from '$lib/paraglide/messages.js';
import { listStandardTiers } from '$lib/queries/membership-tiers';
import { error } from '@sveltejs/kit';
import { pollGetPoll, eventpublicdiscoveryListEvents } from '$lib/api/generated/sdk.gen';
import { extractErrorMessage } from '$lib/utils/errors';
import { log } from '$lib/server/logger';
import { loaderErrorStatus } from '$lib/server/load-errors';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals, parent, fetch }) => {
	const user = locals.user;
	if (!user) throw error(401, m['serverErrors.common.unauthorized']());

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
		listStandardTiers(organization.slug, user.accessToken, fetch).catch((err: unknown) => {
			throw error(
				502,
				extractErrorMessage(err, m['serverErrors.common.loadMembershipTiersFailed']())
			);
		})
	]);

	if (pollRes.error) {
		const status = pollRes.response?.status ?? 500;
		log.error('poll_load_failed', { status, error: pollRes.error });
		const message = extractErrorMessage(pollRes.error, m['serverErrors.common.loadPollFailed']());
		throw error(loaderErrorStatus(status), message);
	}
	// The audience picker depends on these; surface a failure instead of
	// silently rendering an empty event/tier list (mirrors new/+page.server.ts).
	if (eventsRes.error) {
		const status = eventsRes.response?.status ?? 500;
		throw error(
			status >= 500 ? 500 : 502,
			extractErrorMessage(eventsRes.error, m['serverErrors.common.loadEventsFailed']())
		);
	}

	if (!pollRes.data) {
		throw error(500, m['serverErrors.common.loadPollFailed']());
	}

	return {
		poll: pollRes.data,
		events: eventsRes.data?.results ?? [],
		tiers: tiersRes,
		isOwner
	};
};
