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

/**
 * Name-fields-only variant for values that get WRITTEN somewhere (ticket
 * holder names, payment descriptions): preferred_name > first+last > first,
 * else ''. Never falls back to email/username — registration sets
 * username = email for every account, so an email fallback would stamp the
 * buyer's address onto tickets and invoices (the leak BE 8b12be6c fixed
 * server-side). Callers needing a non-empty value supply their own
 * placeholder.
 */
export function getUserRealName(user: UserDisplayInfo): string {
	const preferred = user.preferred_name?.trim();
	if (preferred) return preferred;
	const first = user.first_name?.trim();
	const last = user.last_name?.trim();
	if (first && last) return `${first} ${last}`;
	return first || '';
}

/** The masked account projection staff see on tickets, RSVPs, invitations and scans. */
export interface StaffViewUserInfo extends UserDisplayInfo {
	display_name?: string | null;
	known?: boolean | null;
}

/**
 * Name to show staff for a row's account. The backend's `display_name` wins: for an
 * unknown holder it is the name staff supplied (or the email), and for a known one
 * the account's own display name. Falls back to the legacy field chain so partial
 * objects (older payloads, test fixtures) still render.
 */
export function staffViewDisplayName(user: StaffViewUserInfo, fallback = 'Unknown User'): string {
	const name = user.display_name?.trim();
	if (name) return name;
	return getUserDisplayName(user, fallback);
}

/**
 * The email to show on a secondary line under the name, or null when the name
 * already is the email (an unknown holder with no supplied name), so the same
 * address is not printed twice.
 */
export function secondaryEmail(user: StaffViewUserInfo): string | null {
	const email = user.email?.trim();
	if (!email) return null;
	return user.display_name?.trim() === email ? null : email;
}

/**
 * True when the account's profile is withheld from staff (nothing but the email and the
 * name staff typed). Only an explicit `known: false` counts: a missing flag means an
 * older or partial payload and is treated as known so no hint is shown by mistake.
 */
export function isUnknownHolder(user: StaffViewUserInfo | null | undefined): boolean {
	return user?.known === false;
}
