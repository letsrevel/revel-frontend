/**
 * Date and time formatting utilities for event display
 */

import { getLocale } from '$lib/paraglide/runtime.js';

/**
 * Get the current locale in BCP 47 format (e.g., "en-US", "de-DE", "it-IT")
 */
function getCurrentLocale(): string {
	const locale = getLocale();
	const localeMap: Record<string, string> = {
		en: 'en-US',
		de: 'de-DE',
		it: 'it-IT'
	};
	return localeMap[locale] || 'en-US';
}

/**
 * Format a date-time string for event display
 * @param dateString ISO 8601 date-time string
 * @returns Formatted date string (e.g., "Fri, Oct 20 • 8:00 PM")
 */
export function formatEventDate(dateString: string): string {
	const date = new Date(dateString);
	const locale = getCurrentLocale();

	const dayOfWeek = date.toLocaleDateString(locale, { weekday: 'short' });
	const month = date.toLocaleDateString(locale, { month: 'short' });
	const day = date.getDate();
	const time = date.toLocaleTimeString(locale, {
		hour: 'numeric',
		minute: '2-digit',
		hour12: locale === 'en-US' // Only use 12-hour format for English
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
	const locale = getCurrentLocale();

	const dayOfWeek = start.toLocaleDateString(locale, { weekday: 'short' });
	const month = start.toLocaleDateString(locale, { month: 'short' });
	const day = start.getDate();

	const startTime = start.toLocaleTimeString(locale, {
		hour: 'numeric',
		minute: '2-digit',
		hour12: locale === 'en-US'
	});
	const endTime = end.toLocaleTimeString(locale, {
		hour: 'numeric',
		minute: '2-digit',
		hour12: locale === 'en-US'
	});

	// If same day, show date once
	if (start.toDateString() === end.toDateString()) {
		return `${dayOfWeek}, ${month} ${day} • ${startTime} - ${endTime}`;
	}

	// Different days
	const endDayOfWeek = end.toLocaleDateString(locale, { weekday: 'short' });
	const endMonth = end.toLocaleDateString(locale, { month: 'short' });
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
	const locale = getCurrentLocale();

	const dayOfWeek = date.toLocaleDateString(locale, { weekday: 'long' });
	const month = date.toLocaleDateString(locale, { month: 'long' });
	const day = date.getDate();
	const year = date.getFullYear();
	const time = date.toLocaleTimeString(locale, {
		hour: 'numeric',
		minute: '2-digit',
		hour12: locale === 'en-US'
	});

	// Add ordinal suffix (st, nd, rd, th) - only for English
	if (locale === 'en-US') {
		const ordinal = getOrdinalSuffix(day);
		return `${dayOfWeek}, ${month} ${day}${ordinal}, ${year} at ${time}`;
	}

	// For other locales, use standard format
	return `${dayOfWeek}, ${day} ${month} ${year} ${time}`;
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

/**
 * Format a date for display in admin pages and lists
 * Uses locale-aware formatting with medium date and short time
 * @param dateString ISO 8601 date-time string
 * @returns Formatted date string (e.g., "Oct 20, 2025, 8:00 PM" for en-US or "20. Okt. 2025, 20:00" for de-DE)
 */
export function formatDateTime(dateString: string): string {
	const date = new Date(dateString);
	const locale = getCurrentLocale();

	return date.toLocaleString(locale, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		hour12: locale === 'en-US'
	});
}

/**
 * Format a date without time for display
 * @param dateString ISO 8601 date-time string
 * @returns Formatted date string (e.g., "Oct 20, 2025" for en-US or "20. Okt. 2025" for de-DE)
 */
export function formatDate(dateString: string): string {
	const date = new Date(dateString);
	const locale = getCurrentLocale();

	return date.toLocaleDateString(locale, {
		year: 'numeric',
		month: 'short',
		day: 'numeric'
	});
}
