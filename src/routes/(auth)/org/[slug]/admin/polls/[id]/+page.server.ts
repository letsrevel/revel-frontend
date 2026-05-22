import { error } from '@sveltejs/kit';
import {
	pollGetPoll,
	eventpublicdiscoveryListEvents,
	organizationadminmembersListMembershipTiers
} from '$lib/api/generated/sdk.gen';
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
			query: { organization: organization.id, page_size: 100 }
		}),
		organizationadminmembersListMembershipTiers({
			fetch,
			path: { slug: organization.slug },
			headers: { Authorization: `Bearer ${user.accessToken}` }
		})
	]);

	if (pollRes.error) throw error(404, 'Poll not found');

	return {
		poll: pollRes.data!,
		events: eventsRes.data?.results ?? [],
		tiers: tiersRes.data ?? [],
		accessToken: user.accessToken,
		isOwner
	};
};
