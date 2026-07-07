import type {
	OrganizationPermissionsSchema,
	MembershipStatus,
	MembershipTierSchema
} from '$lib/api/generated/types.gen';

/**
 * Permission helpers for the dashboard, derived from the auth store's
 * OrganizationPermissionsSchema. Pure functions — pass the current
 * `permissions` object in; callers own reactivity.
 */

// Check if user can organize events (is owner/staff of at least one org)
export function canOrganizeEvents(permissions: OrganizationPermissionsSchema | null): boolean {
	if (!permissions?.organization_permissions) return false;

	// Check if user is owner or has organizing permissions for any org
	return Object.values(permissions.organization_permissions).some((orgPerms) => {
		// If owner, they can organize
		if (orgPerms === 'owner') return true;

		// Check if they have event creation/management permissions
		if (typeof orgPerms === 'object' && orgPerms.default) {
			const perms = orgPerms.default;
			return !!(perms.create_event || perms.manage_event);
		}

		return false;
	});
}

// Helper to check if user has admin permissions for an organization
export function hasAdminPermissions(
	permissions: OrganizationPermissionsSchema | null,
	orgId: string
): boolean {
	if (!permissions?.organization_permissions) {
		return false;
	}

	const orgPerms = permissions.organization_permissions[orgId];

	// If user is owner, they have all permissions
	if (orgPerms === 'owner') {
		return true;
	}

	// Check if user has any admin-level permissions
	if (typeof orgPerms === 'object' && orgPerms.default) {
		const perms = orgPerms.default;
		return !!(
			perms.edit_organization ||
			perms.manage_members ||
			perms.create_event ||
			perms.manage_event
		);
	}

	return false;
}

// Helper to get membership status for an organization
export function getMembershipStatus(
	permissions: OrganizationPermissionsSchema | null,
	orgId: string
): MembershipStatus | null {
	if (!permissions?.memberships) return null;
	const membership = permissions.memberships[orgId];
	return membership?.status ? (membership.status as MembershipStatus) : null;
}

// Helper to get membership tier for an organization
export function getMembershipTier(
	permissions: OrganizationPermissionsSchema | null,
	orgId: string
): MembershipTierSchema | null {
	if (!permissions?.memberships) return null;
	const membership = permissions.memberships[orgId];
	return membership?.tier || null;
}

// Helper to check if user is owner
export function isOwner(permissions: OrganizationPermissionsSchema | null, orgId: string): boolean {
	if (!permissions?.organization_permissions) return false;
	return permissions.organization_permissions[orgId] === 'owner';
}

// Helper to check if user is staff (not owner)
export function isStaff(permissions: OrganizationPermissionsSchema | null, orgId: string): boolean {
	if (!permissions?.organization_permissions) return false;
	const orgPerms = permissions.organization_permissions[orgId];
	return typeof orgPerms === 'object' && orgPerms !== null;
}

// Helper to check if user owns any organization
export function ownsOrganization(permissions: OrganizationPermissionsSchema | null): boolean {
	if (!permissions?.organization_permissions) return false;
	return Object.values(permissions.organization_permissions).some((perms) => perms === 'owner');
}

// Status badge styling (matching MemberCard.svelte)
export const statusStyles: Record<MembershipStatus, string> = {
	active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
	paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
	cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100',
	banned: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'
};
