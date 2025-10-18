import type {
	OrganizationPermissionsSchema,
	PermissionsSchema,
	PermissionMap
} from '$lib/types/auth';

/**
 * Check if user is an owner of an organization
 */
export function isOwner(permissions: OrganizationPermissionsSchema | null, orgId: string): boolean {
	if (!permissions?.organization_permissions) {
		return false;
	}

	const orgPerms = permissions.organization_permissions[orgId];
	return orgPerms === 'owner';
}

/**
 * Get permissions for an organization
 * Returns null if no permissions found or user is owner (owners have all permissions)
 */
export function getOrgPermissions(
	permissions: OrganizationPermissionsSchema | null,
	orgId: string
): PermissionsSchema | null {
	if (!permissions?.organization_permissions) {
		return null;
	}

	const orgPerms = permissions.organization_permissions[orgId];

	// Owners have all permissions implicitly
	if (orgPerms === 'owner') {
		return null;
	}

	return orgPerms || null;
}

/**
 * Check if user can perform a specific action in an organization
 * Owners can perform all actions
 */
export function canPerformAction(
	permissions: OrganizationPermissionsSchema | null,
	orgId: string,
	action: keyof PermissionMap
): boolean {
	if (!permissions?.organization_permissions) {
		return false;
	}

	const orgPerms = permissions.organization_permissions[orgId];

	// Owners can do everything
	if (orgPerms === 'owner') {
		return true;
	}

	// Check if user has permission
	if (!orgPerms) {
		return false;
	}

	// Check default permissions
	const hasDefaultPermission = orgPerms.default?.[action] === true;

	return hasDefaultPermission;
}

/**
 * Check if user can perform a specific action on a specific event
 * Checks both default permissions and event-specific overrides
 */
export function canPerformActionOnEvent(
	permissions: OrganizationPermissionsSchema | null,
	orgId: string,
	eventId: string,
	action: keyof PermissionMap
): boolean {
	if (!permissions?.organization_permissions) {
		return false;
	}

	const orgPerms = permissions.organization_permissions[orgId];

	// Owners can do everything
	if (orgPerms === 'owner') {
		return true;
	}

	if (!orgPerms) {
		return false;
	}

	// Check event-specific override first
	if (orgPerms.event_overrides?.[eventId]) {
		const eventPermission = orgPerms.event_overrides[eventId][action];
		if (eventPermission !== undefined) {
			return eventPermission === true;
		}
	}

	// Fall back to default permissions
	return orgPerms.default?.[action] === true;
}

/**
 * Get all permission keys where user has access
 * Useful for debugging or admin UIs
 */
export function getAllowedActions(
	permissions: OrganizationPermissionsSchema | null,
	orgId: string
): Array<keyof PermissionMap> {
	if (!permissions?.organization_permissions) {
		return [];
	}

	const orgPerms = permissions.organization_permissions[orgId];

	// Owners have all permissions
	if (orgPerms === 'owner') {
		return [
			'create_event',
			'create_event_series',
			'edit_event_series',
			'delete_event_series',
			'edit_event',
			'delete_event',
			'open_event',
			'close_event',
			'manage_event',
			'manage_tickets',
			'check_in_attendees',
			'invite_to_event',
			'edit_organization',
			'manage_members',
			'manage_potluck',
			'create_questionnaire',
			'edit_questionnaire',
			'delete_questionnaire',
			'evaluate_questionnaire',
			'manage_membership'
		];
	}

	if (!orgPerms?.default) {
		return [];
	}

	// Return only the actions where permission is true
	return (Object.keys(orgPerms.default) as Array<keyof PermissionMap>).filter(
		(key) => orgPerms.default?.[key] === true
	);
}

/**
 * Check if user has any admin permissions in an organization
 * Useful for showing/hiding admin UI sections
 */
export function hasAnyAdminPermission(
	permissions: OrganizationPermissionsSchema | null,
	orgId: string
): boolean {
	return getAllowedActions(permissions, orgId).length > 0;
}

/**
 * Get a user-friendly message explaining why an action is not allowed
 */
export function getPermissionDeniedMessage(
	permissions: OrganizationPermissionsSchema | null,
	orgId: string,
	action: keyof PermissionMap
): string {
	if (!permissions?.organization_permissions) {
		return 'You are not authenticated';
	}

	const orgPerms = permissions.organization_permissions[orgId];

	if (!orgPerms) {
		return 'You do not have access to this organization';
	}

	if (orgPerms === 'owner') {
		return ''; // Shouldn't happen, owners have all permissions
	}

	// Provide action-specific messages
	const actionMessages: Partial<Record<keyof PermissionMap, string>> = {
		create_event: 'You do not have permission to create events',
		edit_event: 'You do not have permission to edit events',
		delete_event: 'You do not have permission to delete events',
		manage_members: 'You do not have permission to manage members',
		check_in_attendees: 'You do not have permission to check in attendees',
		evaluate_questionnaire: 'You do not have permission to evaluate questionnaires',
		manage_tickets: 'You do not have permission to manage tickets',
		invite_to_event: 'You do not have permission to invite users to events'
	};

	return actionMessages[action] || `You do not have permission to ${action}`;
}
