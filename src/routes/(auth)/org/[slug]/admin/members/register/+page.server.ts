import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { canPerformAction } from '$lib/utils/permissions';

export const load: PageServerLoad = async ({ parent }) => {
	const { organization, isOwner, permissions } = await parent();

	// Mirrors the backend guard on every register route: `manage_members`
	// (owners always hold it). Deleting additionally requires being the owner.
	const canManageMembers =
		isOwner || canPerformAction(permissions, organization.id, 'manage_members');

	if (!canManageMembers) {
		throw error(403, 'You do not have permission to manage the member register');
	}

	return { organization, isOwner };
};
