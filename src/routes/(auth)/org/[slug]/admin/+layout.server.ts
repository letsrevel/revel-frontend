import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { organizationGetOrganization, permissionMyPermissions } from '$lib/api';

export const load: LayoutServerLoad = async ({ locals, params, fetch }) => {
	const user = locals.user;

	// Ensure user is authenticated
	if (!user) {
		throw error(401, 'You must be logged in to access this page');
	}

	// Prepare headers with authentication
	const headers: HeadersInit = {
		Authorization: `Bearer ${user.accessToken}`
	};

	try {
		// Load organization
		const orgResponse = await organizationGetOrganization({
			fetch,
			path: { slug: params.slug },
			headers
		});

		if (!orgResponse.data) {
			throw error(404, 'Organization not found');
		}

		const organization = orgResponse.data;

		// Load user permissions
		const permissionsResponse = await permissionMyPermissions({
			fetch,
			headers
		});

		const permissions = permissionsResponse.data || null;

		// Check if user has permissions to manage this organization
		const orgPermissions = permissions?.organization_permissions?.[organization.id];

		// User can access admin if they are owner OR staff member
		const isOwner = orgPermissions === 'owner';
		const isStaff = orgPermissions && orgPermissions !== 'owner';

		if (!isOwner && !isStaff) {
			throw error(403, 'You do not have permission to manage this organization');
		}

		// Extract permission flags for UI conditional rendering
		let canCreateEvent = false;

		if (isOwner) {
			// Owners have all permissions
			canCreateEvent = true;
		} else if (isStaff && typeof orgPermissions === 'object') {
			// Check if staff member has create_event permission
			canCreateEvent = orgPermissions.default?.create_event === true;
		}

		return {
			organization,
			isOwner,
			isStaff,
			canCreateEvent,
			permissions
		};
	} catch (err) {
		// Handle API errors
		if (typeof err === 'object' && err !== null && 'status' in err) {
			const status = (err as { status: number }).status;

			if (status === 404) {
				throw error(404, 'Organization not found');
			}

			if (status === 403) {
				throw error(403, 'You do not have permission to view this organization');
			}
		}

		// Re-throw SvelteKit errors
		if (err && typeof err === 'object' && 'status' in err && 'body' in err) {
			throw err;
		}

		// Generic error
		console.error('Error loading organization admin:', err);
		throw error(500, 'Failed to load organization');
	}
};
