import type {
	RevelUserSchema,
	OrganizationPermissionsSchema,
	PermissionsSchema,
	PermissionMap
} from '$lib/api';

/**
 * Authentication state interface
 */
export interface AuthState {
	/** Current authenticated user */
	user: RevelUserSchema | null;
	/** JWT access token (stored in memory) */
	accessToken: string | null;
	/** User's permissions per organization */
	permissions: OrganizationPermissionsSchema | null;
	/** Whether the user is authenticated */
	isAuthenticated: boolean;
	/** Whether auth is currently loading */
	isLoading: boolean;
}

/**
 * Organization permissions map
 * Maps organization ID to either 'owner' or permission schema
 */
export type OrgPermissionsMap = {
	[orgId: string]: PermissionsSchema | 'owner';
};

/**
 * Re-export generated types for convenience
 */
export type { RevelUserSchema, OrganizationPermissionsSchema, PermissionsSchema, PermissionMap };

/**
 * Permission check result
 */
export interface PermissionCheckResult {
	allowed: boolean;
	reason?: string;
}
