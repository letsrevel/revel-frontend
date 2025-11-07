import type { OrganizationTokenSchema, EventTokenSchema } from '$lib/api/generated/types.gen';

/**
 * Determine the status of an organization token
 */
export function getOrganizationTokenStatus(
	token: OrganizationTokenSchema
): 'active' | 'expired' | 'limit-reached' {
	// Check if expired
	if (token.expires_at && new Date(token.expires_at) < new Date()) {
		return 'expired';
	}

	// Check if limit reached
	if (
		token.max_uses !== undefined &&
		token.max_uses > 0 &&
		token.uses !== undefined &&
		token.uses >= token.max_uses
	) {
		return 'limit-reached';
	}

	return 'active';
}

/**
 * Determine the status of an event token
 */
export function getEventTokenStatus(
	token: EventTokenSchema
): 'active' | 'expired' | 'limit-reached' {
	// Check if expired
	if (token.expires_at && new Date(token.expires_at) < new Date()) {
		return 'expired';
	}

	// Check if limit reached
	if (
		token.max_uses !== undefined &&
		token.max_uses > 0 &&
		token.uses !== undefined &&
		token.uses >= token.max_uses
	) {
		return 'limit-reached';
	}

	return 'active';
}

/**
 * Check if a token is active (not expired and not at limit)
 */
export function isTokenActive(token: OrganizationTokenSchema | EventTokenSchema): boolean {
	const status =
		'grants_membership' in token
			? getOrganizationTokenStatus(token as OrganizationTokenSchema)
			: getEventTokenStatus(token as EventTokenSchema);

	return status === 'active';
}

/**
 * Format token usage display (e.g., "45/100" or "45/∞")
 */
export function formatTokenUsage(uses: number | undefined, maxUses: number | undefined): string {
	const usesValue = uses ?? 0;
	const maxUsesValue = maxUses ?? 0;

	if (maxUsesValue === 0) {
		return `${usesValue}/∞`;
	}
	return `${usesValue}/${maxUsesValue}`;
}

/**
 * Calculate time until expiration
 */
export function getExpirationDisplay(expiresAt: string | null): string {
	if (!expiresAt) {
		return 'Never';
	}

	const now = new Date();
	const expiry = new Date(expiresAt);
	const diff = expiry.getTime() - now.getTime();

	if (diff < 0) {
		return 'Expired';
	}

	const days = Math.floor(diff / (1000 * 60 * 60 * 24));
	const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

	if (days > 0) {
		return `${days} day${days === 1 ? '' : 's'}`;
	} else if (hours > 0) {
		return `${hours} hour${hours === 1 ? '' : 's'}`;
	} else {
		return 'Less than 1 hour';
	}
}

/**
 * Generate shareable organization token URL
 */
export function getOrganizationTokenUrl(tokenId: string, orgSlug?: string): string {
	const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

	if (orgSlug) {
		// Visibility URL with query param
		return `${baseUrl}/org/${orgSlug}?ot=${tokenId}`;
	}

	// Claiming URL
	return `${baseUrl}/join/org/${tokenId}`;
}

/**
 * Generate shareable event token URL
 */
export function getEventTokenUrl(tokenId: string, orgSlug?: string, eventSlug?: string): string {
	const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

	if (orgSlug && eventSlug) {
		// Visibility URL with query param
		return `${baseUrl}/events/${orgSlug}/${eventSlug}?et=${tokenId}`;
	}

	// Claiming URL
	return `${baseUrl}/join/event/${tokenId}`;
}

/**
 * Get duration options for token creation
 */
export const durationOptions = [
	{ label: '1 Hour', value: 60 },
	{ label: '1 Day', value: 1440 },
	{ label: '7 Days', value: 10080 },
	{ label: '30 Days', value: 43200 },
	{ label: 'Never', value: 0 }
] as const;

/**
 * Get label for duration value
 */
export function getDurationLabel(minutes: number): string {
	const option = durationOptions.find((opt) => opt.value === minutes);
	return option?.label || `${minutes} minutes`;
}
