import { error } from '@sveltejs/kit';
import { organizationGetOrganization, permissionMyPermissions } from '$lib/api';
import type { PageServerLoad } from './$types';
import type { OrganizationPermissionsSchema } from '$lib/api/generated/types.gen';
import { canPerformAction } from '$lib/utils/permissions';

export const load: PageServerLoad = async ({ params, locals, fetch }) => {
	const { slug } = params;

	try {
		// Prepare headers with authentication if user is logged in
		const headers: HeadersInit = {};
		if (locals.user?.accessToken) {
			headers['Authorization'] = `Bearer ${locals.user.accessToken}`;
		}

		// Fetch organization details
		const orgResponse = await organizationGetOrganization({
			fetch,
			path: { slug },
			headers
		});

		if (!orgResponse.data) {
			throw error(404, 'Organization not found');
		}

		const organization = orgResponse.data;

		// Check if user can edit this organization (requires authentication)
		let canEdit = false;
		if (locals.user) {
			try {
				const permissionsResponse = await permissionMyPermissions({
					fetch,
					headers
				});

				if (permissionsResponse.data) {
					const userPermissions: OrganizationPermissionsSchema = permissionsResponse.data;
					// User can edit if they have 'edit_organization' permission
					canEdit = canPerformAction(userPermissions, organization.id, 'edit_organization');
				}
			} catch (err) {
				// If permissions fail to load, continue without them
				// User will not be able to edit by default
				console.error('Failed to fetch user permissions:', err);
			}
		}

		return {
			organization,
			canEdit,
			// Explicitly pass authentication state to the page
			isAuthenticated: !!locals.user
		};
	} catch (err) {
		// Handle different error types
		if (typeof err === 'object' && err !== null && 'status' in err) {
			const status = (err as { status: number }).status;

			if (status === 404) {
				throw error(404, 'Organization not found');
			}

			if (status === 403) {
				throw error(403, 'You do not have permission to view this organization');
			}
		}

		// Generic error
		console.error('Error loading organization:', err);
		throw error(500, 'Failed to load organization details');
	}
};
