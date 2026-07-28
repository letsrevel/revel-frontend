import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { canPerformAction } from '$lib/utils/permissions';

export const load: PageServerLoad = async ({ parent }) => {
	// Get organization data and permissions from parent layout
	const { organization, isOwner, isStaff, permissions } = await parent();

	const canManageMembers =
		isOwner || canPerformAction(permissions, organization.id, 'manage_members');
	const canManageSubscriptions =
		isOwner || canPerformAction(permissions, organization.id, 'manage_subscriptions');

	// `manage_subscriptions` is a standalone role: a billing staffer who cannot
	// touch the roster still needs this page for the Subscriptions tab. Each tab
	// is gated on its own flag below.
	if (!canManageMembers && !canManageSubscriptions) {
		throw error(403, 'You do not have permission to manage members');
	}

	return {
		organization,
		isOwner,
		isStaff,
		permissions,
		canManageMembers,
		canManageSubscriptions
	};
};
