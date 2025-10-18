/**
 * Event-specific utility functions
 */

import type { EventInListSchema } from '$lib/api/generated/types.gen';

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
	// Staff/owner always see "Free" if free_for_staff
	if (userIsStaff && event.free_for_staff) {
		return 'Free (Staff)';
	}

	// Members see "Free" if free_for_members
	if (userIsMember && event.free_for_members) {
		return 'Free (Member)';
	}

	// For everyone else, indicate ticket requirement
	if (event.requires_ticket) {
		// If free for members but user is not a member, indicate that
		if (event.free_for_members) {
			return 'Ticketed (Free for members)';
		}
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
