/**
 * Date and time formatting utilities for event display
 */

/**
 * Format a date-time string for event display
 * @param dateString ISO 8601 date-time string
 * @returns Formatted date string (e.g., "Fri, Oct 20 • 8:00 PM")
 */
export function formatEventDate(dateString: string): string {
	const date = new Date(dateString);

	const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' });
	const month = date.toLocaleDateString('en-US', { month: 'short' });
	const day = date.getDate();
	const time = date.toLocaleTimeString('en-US', {
		hour: 'numeric',
		minute: '2-digit',
		hour12: true
	});

	return `${dayOfWeek}, ${month} ${day} • ${time}`;
}

/**
 * Format a date range for event display
 * @param startString ISO 8601 start date-time string
 * @param endString ISO 8601 end date-time string
 * @returns Formatted date range (e.g., "Fri, Oct 20 • 8:00 PM - 11:00 PM")
 */
export function formatEventDateRange(startString: string, endString: string): string {
	const start = new Date(startString);
	const end = new Date(endString);

	const dayOfWeek = start.toLocaleDateString('en-US', { weekday: 'short' });
	const month = start.toLocaleDateString('en-US', { month: 'short' });
	const day = start.getDate();

	const startTime = start.toLocaleTimeString('en-US', {
		hour: 'numeric',
		minute: '2-digit',
		hour12: true
	});
	const endTime = end.toLocaleTimeString('en-US', {
		hour: 'numeric',
		minute: '2-digit',
		hour12: true
	});

	// If same day, show date once
	if (start.toDateString() === end.toDateString()) {
		return `${dayOfWeek}, ${month} ${day} • ${startTime} - ${endTime}`;
	}

	// Different days
	const endDayOfWeek = end.toLocaleDateString('en-US', { weekday: 'short' });
	const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
	const endDay = end.getDate();

	return `${dayOfWeek}, ${month} ${day} • ${startTime} - ${endDayOfWeek}, ${endMonth} ${endDay} • ${endTime}`;
}

/**
 * Get a relative time description for an RSVP deadline
 * @param deadlineString ISO 8601 date-time string
 * @returns Relative time description (e.g., "in 2 days", "in 3 hours", "closed")
 */
export function getRSVPDeadlineRelative(deadlineString: string): string {
	const deadline = new Date(deadlineString);
	const now = new Date();
	const diffMs = deadline.getTime() - now.getTime();

	// Already passed
	if (diffMs < 0) {
		return 'closed';
	}

	const diffMinutes = Math.floor(diffMs / (1000 * 60));
	const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (diffMinutes < 60) {
		return `in ${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`;
	}

	if (diffHours < 24) {
		return `in ${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
	}

	return `in ${diffDays} day${diffDays !== 1 ? 's' : ''}`;
}

/**
 * Check if an event is in the past
 * @param endString ISO 8601 end date-time string
 * @returns true if event has ended
 */
export function isEventPast(endString: string): boolean {
	const end = new Date(endString);
	const now = new Date();
	return end < now;
}

/**
 * Check if RSVP deadline has passed
 * @param deadlineString ISO 8601 date-time string, null, or undefined
 * @returns true if deadline has passed
 */
export function isRSVPClosed(deadlineString: string | null | undefined): boolean {
	if (!deadlineString) return false;

	const deadline = new Date(deadlineString);
	const now = new Date();
	return deadline < now;
}

/**
 * Check if RSVP deadline is within 24 hours
 * @param deadlineString ISO 8601 date-time string or null
 * @returns true if deadline is within 24 hours
 */
export function isRSVPClosingSoon(deadlineString: string | null): boolean {
	if (!deadlineString) return false;

	const deadline = new Date(deadlineString);
	const now = new Date();
	const diffMs = deadline.getTime() - now.getTime();
	const diffHours = diffMs / (1000 * 60 * 60);

	return diffHours > 0 && diffHours < 24;
}

/**
 * Format a date for screen readers (more verbose)
 * @param dateString ISO 8601 date-time string
 * @returns Verbose date string (e.g., "Friday, October 20th, 2025 at 8:00 PM")
 */
export function formatEventDateForScreenReader(dateString: string): string {
	const date = new Date(dateString);

	const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
	const month = date.toLocaleDateString('en-US', { month: 'long' });
	const day = date.getDate();
	const year = date.getFullYear();
	const time = date.toLocaleTimeString('en-US', {
		hour: 'numeric',
		minute: '2-digit',
		hour12: true
	});

	// Add ordinal suffix (st, nd, rd, th)
	const ordinal = getOrdinalSuffix(day);

	return `${dayOfWeek}, ${month} ${day}${ordinal}, ${year} at ${time}`;
}

/**
 * Get ordinal suffix for a day number
 * @param day Day of month (1-31)
 * @returns Ordinal suffix ("st", "nd", "rd", "th")
 */
function getOrdinalSuffix(day: number): string {
	if (day > 3 && day < 21) return 'th';
	switch (day % 10) {
		case 1:
			return 'st';
		case 2:
			return 'nd';
		case 3:
			return 'rd';
		default:
			return 'th';
	}
}
