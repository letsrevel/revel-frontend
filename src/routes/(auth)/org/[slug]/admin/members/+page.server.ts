import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { canPerformAction } from '$lib/utils/permissions';

export const load: PageServerLoad = async ({ parent }) => {
	// Get organization data and permissions from parent layout
	const { organization, isOwner, isStaff, permissions } = await parent();

	// Check if user has permission to manage members
	const canManageMembers =
		isOwner || canPerformAction(permissions, organization.id, 'manage_members');

	if (!canManageMembers) {
		throw error(403, 'You do not have permission to manage members');
	}

	return {
		organization,
		isOwner,
		isStaff,
		permissions
	};
};
