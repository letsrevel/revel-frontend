import { error } from '@sveltejs/kit';
import {
	organizationGetOrganization,
	permissionMyPermissions,
	organizationListResources,
	organizationGetOrganizationTokenDetails
} from '$lib/api';
import type { PageServerLoad } from './$types';
import type { OrganizationPermissionsSchema, OrganizationTokenSchema } from '$lib/api/generated/types.gen';
import { canPerformAction } from '$lib/utils/permissions';

export const load: PageServerLoad = async ({ params, locals, fetch, url }) => {
	const { slug } = params;

	try {
		// Prepare headers with authentication if user is logged in
		const headers: HeadersInit = {};
		if (locals.user?.accessToken) {
			headers['Authorization'] = `Bearer ${locals.user.accessToken}`;
		}

		// Check for organization token (?ot=) for visibility
		const orgToken = url.searchParams.get('ot');
		if (orgToken) {
			headers['X-Org-Token'] = orgToken;
		}

		// Fetch organization details (pass auth and token to see private organizations)
		const orgResponse = await organizationGetOrganization({
			fetch,
			path: { slug },
			headers
		});

		if (!orgResponse.data) {
			throw error(404, 'Organization not found');
		}

		const organization = orgResponse.data;

		// Fetch public resources for this organization
		const resourcesResponse = await organizationListResources({
			fetch,
			path: { slug }
		});

		const resources = resourcesResponse.data?.results || [];

		// Check if user can edit this organization and if they're already a member (requires authentication)
		let canEdit = false;
		let isMember = false;
		let isOwner = false;
		let isStaff = false;
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

					// Check if user is a member using the memberships list
					isMember = userPermissions.memberships?.includes(organization.id) || false;

					// Check if user is owner or staff
					const orgPermissions = userPermissions.organization_permissions?.[organization.id];
					if (orgPermissions === 'owner') {
						isOwner = true;
					} else if (orgPermissions && typeof orgPermissions === 'object') {
						// If orgPermissions is an object with permission keys, user is staff
						isStaff = true;
					}
				}

			} catch (err) {
				// If permissions fail to load, continue without them
				// User will not be able to edit by default
				console.error('Failed to fetch user permissions:', err);
			}
		}

	// Fetch organization token details if token parameter is present
	let organizationTokenDetails: OrganizationTokenSchema | null = null;
	if (orgToken) {
		try {
			const tokenResponse = await organizationGetOrganizationTokenDetails({
				fetch,
				path: { token_id: orgToken },
				headers
			});

			if (tokenResponse.data) {
				organizationTokenDetails = tokenResponse.data;
			}
		} catch (err) {
			// If token is invalid or expired, continue without it
			console.error('Failed to fetch organization token details:', err);
		}
	}

		return {
			organization,
			resources,
			canEdit,
			isMember,
			isOwner,
			isStaff,
organizationTokenDetails,			// Explicitly pass authentication state to the page
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
