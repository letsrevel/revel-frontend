import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { canPerformAction } from '$lib/utils/permissions';

export const load: PageServerLoad = async ({ parent }) => {
	const { organization, isOwner, permissions } = await parent();

	// Mirrors the backend guard on
	// `GET /organization-admin/{slug}/members/verify/{code}` — door staff get this
	// permission by default, and it is deliberately NOT `manage_members`: verifying
	// a card at a door is not editing the roster.
	const canVerifyMembers =
		isOwner || canPerformAction(permissions, organization.id, 'check_in_attendees');

	if (!canVerifyMembers) {
		throw error(403, 'You do not have permission to verify members');
	}

	return { organization };
};
