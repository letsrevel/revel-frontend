/**
 * Event-specific utility functions
 */

import type {
	EventInListSchema,
	EventDetailSchema,
	MinimalEventSchema
} from '$lib/api/generated/types.gen';

/**
 * Get display string for event access/pricing
 * Note: EventInListSchema does NOT include ticket price data.
 * This function shows access type only (Free RSVP, Ticketed, etc.)
 *
 * @param event Event data from list API
 * @param userIsMember Is the current user a member of the event's organization?
 * @param userIsStaff Is the current user staff/owner of the event's organization?
 * @returns Access type display string
 */
export function getEventAccessDisplay(
	event: EventInListSchema,
	userIsMember: boolean = false,
	userIsStaff: boolean = false
): string {
	// Note: free_for_members and free_for_staff fields have been removed from the backend.
	// Pricing/access is now managed through ticket tier membership/staff restrictions.

	// For everyone, indicate ticket requirement
	if (event.requires_ticket) {
		// Could be free or paid, we don't know without fetching ticket tiers
		return 'Ticketed';
	}

	// No ticket required = free RSVP
	return 'Free RSVP';
}

/**
 * Check if event is at capacity
 * @param event Event data
 * @returns true if event is full
 */
export function isEventFull(event: EventInListSchema): boolean {
	const maxAttendees = event.max_attendees ?? 0;
	if (maxAttendees === 0) return false; // No limit
	return event.attendee_count >= maxAttendees;
}

/**
 * Get spots remaining (or null if no limit)
 * @param event Event data
 * @returns Number of spots remaining, or null if unlimited
 */
export function getSpotsRemaining(event: EventInListSchema): number | null {
	const maxAttendees = event.max_attendees ?? 0;
	if (maxAttendees === 0) return null; // Unlimited
	return Math.max(0, maxAttendees - event.attendee_count);
}

/**
 * Generate a deterministic gradient class for event fallback images
 * @param eventId Event UUID
 * @returns Tailwind gradient class string
 */
export function getEventFallbackGradient(eventId: string): string {
	const gradients = [
		'from-purple-500 to-pink-500',
		'from-blue-500 to-cyan-500',
		'from-green-500 to-emerald-500',
		'from-orange-500 to-red-500',
		'from-indigo-500 to-purple-500',
		'from-teal-500 to-green-500'
	];

	// Hash event ID to select gradient (deterministic)
	const hash = eventId.split('').reduce((acc, char) => char.charCodeAt(0) + acc, 0);
	return gradients[Math.abs(hash) % gradients.length];
}

/**
 * Format event location from address and city fields
 * Note: Only EventDetailSchema has address and city fields.
 * EventInListSchema does not include location data.
 * @param event Event detail data with address and city
 * @returns Formatted location string or undefined if no location data
 */
export function formatEventLocation(event: EventDetailSchema): string | undefined {
	if (!event.address && !event.city) return undefined;

	const parts: string[] = [];

	// Add street address if available
	if (event.address) {
		parts.push(event.address);
	}

	// Add city and country if available
	if (event.city) {
		const cityPart = [event.city.name, event.city.country].filter(Boolean).join(', ');
		if (cityPart) {
			parts.push(cityPart);
		}
	}

	return parts.length > 0 ? parts.join(', ') : undefined;
}

/**
 * Get event logo with fallback hierarchy:
 * 1. Event's logo
 * 2. Event series' logo (if event is part of a series)
 * 3. Organization's logo
 *
 * @param event Event data (can be MinimalEventSchema, EventInListSchema, or EventDetailSchema)
 * @returns Logo URL path (relative) or null if no logo available
 */
export function getEventLogo(
	event: MinimalEventSchema | EventDetailSchema | EventInListSchema
): string | null {
	// First priority: Event's own logo
	if (event.logo) {
		return event.logo;
	}

	// Second priority: Event series logo (may not exist in MinimalEventSchema)
	if ('event_series' in event && event.event_series?.logo) {
		return event.event_series.logo;
	}

	// Third priority: Organization logo (may not exist in MinimalEventSchema)
	if ('organization' in event && event.organization?.logo) {
		return event.organization.logo;
	}

	return null;
}

/**
 * Get event cover art with fallback hierarchy:
 * 1. Event's cover_art
 * 2. Event series' cover_art (if event is part of a series)
 * 3. Organization's cover_art
 *
 * @param event Event data (can be MinimalEventSchema, EventInListSchema, or EventDetailSchema)
 * @returns Cover art URL path (relative) or null if no cover art available
 */
export function getEventCoverArt(
	event: MinimalEventSchema | EventDetailSchema | EventInListSchema
): string | null {
	// First priority: Event's own cover art
	if (event.cover_art) {
		return event.cover_art;
	}

	// Second priority: Event series cover art (may not exist in MinimalEventSchema)
	if ('event_series' in event && event.event_series?.cover_art) {
		return event.event_series.cover_art;
	}

	// Third priority: Organization cover art (may not exist in MinimalEventSchema)
	if ('organization' in event && event.organization?.cover_art) {
		return event.organization.cover_art;
	}

	return null;
}
