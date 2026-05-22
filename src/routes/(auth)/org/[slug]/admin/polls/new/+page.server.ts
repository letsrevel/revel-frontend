import { error } from '@sveltejs/kit';
import {
	eventpublicdiscoveryListEvents,
	organizationadminmembersListMembershipTiers
} from '$lib/api/generated/sdk.gen';
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

	return {
		events: eventsRes.data?.results ?? [],
		tiers: tiersRes.data ?? [],
		accessToken: user.accessToken
	};
};
