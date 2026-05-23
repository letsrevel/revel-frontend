import { error } from '@sveltejs/kit';
import {
	eventpublicdiscoveryListEvents,
	organizationadminmembersListMembershipTiers
} from '$lib/api/generated/sdk.gen';
import { extractErrorMessage } from '$lib/utils/errors';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent, fetch }) => {
	const user = locals.user;
	if (!user) throw error(401, 'Unauthorized');

	const { organization } = await parent();

	const [eventsRes, tiersRes] = await Promise.all([
		eventpublicdiscoveryListEvents({
			fetch,
			query: { organization: organization.id, page_size: 100 }
		}),
		organizationadminmembersListMembershipTiers({
			fetch,
			path: { slug: organization.slug },
			headers: { Authorization: `Bearer ${user.accessToken}` }
		})
	]);

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

	return {
		events: eventsRes.data?.results ?? [],
		tiers: tiersRes.data ?? [],
		accessToken: user.accessToken
	};
};
