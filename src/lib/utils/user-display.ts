/**
 * User display name utilities.
 * Shared across admin pages: tickets, attendees, invitations, check-in dialog.
 */

export interface UserDisplayInfo {
	preferred_name?: string | null;
	first_name?: string | null;
	last_name?: string | null;
	email?: string | null;
}

/**
 * Get a display-friendly name for a user, using the best available field.
 * Priority: preferred_name > first_name + last_name > first_name > email > fallback
 */
export function getUserDisplayName(user: UserDisplayInfo, fallback = 'Unknown User'): string {
	if (user.preferred_name) return user.preferred_name;
	if (user.first_name && user.last_name) return `${user.first_name} ${user.last_name}`;
	if (user.first_name) return user.first_name;
	if (user.email) return user.email;
	return fallback;
}

/**
 * Get the user's email if available.
 */
export function getUserEmail(user: UserDisplayInfo): string | undefined {
	return user.email ?? undefined;
}
