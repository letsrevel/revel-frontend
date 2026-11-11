import * as m from '$lib/paraglide/messages.js';
import { listStandardTiers } from '$lib/queries/membership-tiers';
import { error } from '@sveltejs/kit';
import { eventpublicdiscoveryListEvents } from '$lib/api/generated/sdk.gen';
import { extractErrorMessage } from '$lib/utils/errors';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent, fetch }) => {
	const user = locals.user;
	if (!user) throw error(401, m['serverErrors.common.unauthorized']());

	const { organization } = await parent();

	const [eventsRes, tiersRes] = await Promise.all([
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

	if (eventsRes.error) {
		const status = eventsRes.response?.status ?? 500;
		throw error(
			status >= 500 ? 500 : 502,
			extractErrorMessage(eventsRes.error, m['serverErrors.common.loadEventsFailed']())
		);
	}

	return {
		events: eventsRes.data?.results ?? [],
		tiers: tiersRes
	};
};
