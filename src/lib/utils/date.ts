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
 * Build the `timeZone` slice of an Intl options object.
 *
 * When a `timeZone` (IANA name, e.g. "Europe/Vienna") is supplied, all date
 * parts are computed in that zone; when omitted, Intl falls back to the
 * viewer's browser timezone — preserving the original behaviour for callers
 * that don't pass one (non-event datetimes, etc.).
 */
function tzOpt(timeZone?: string): { timeZone?: string } {
	return timeZone ? { timeZone } : {};
}

/**
 * Get the short timezone abbreviation for an instant (e.g. "CET", "PST",
 * or "GMT+1" for zones the locale has no abbreviation for).
 * Returns "" when no timezone is supplied so viewer-local displays are
 * left unchanged.
 */
function getTimeZoneAbbreviation(date: Date, locale: string, timeZone?: string): string {
	if (!timeZone) return '';
	const parts = new Intl.DateTimeFormat(locale, {
		timeZone,
		timeZoneName: 'short'
	}).formatToParts(date);
	return parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
}

/**
 * The day-of-month as computed in the given timezone (falls back to the
 * viewer's zone when none is supplied). Used instead of `Date.getDate()`,
 * which is always viewer-local.
 */
function dayOfMonthInZone(date: Date, locale: string, timeZone?: string): string {
	return date.toLocaleDateString(locale, { day: 'numeric', ...tzOpt(timeZone) });
}

/**
 * Whether two instants land on the same calendar day in the given timezone.
 * Uses en-CA (ISO-like YYYY-MM-DD) for a stable, locale-independent compare.
 */
function isSameDayInZone(a: Date, b: Date, timeZone?: string): boolean {
	const opts: Intl.DateTimeFormatOptions = {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		...tzOpt(timeZone)
	};
	return a.toLocaleDateString('en-CA', opts) === b.toLocaleDateString('en-CA', opts);
}

/**
 * Append a timezone abbreviation to a formatted time string when present.
 */
function withTz(formatted: string, abbreviation: string): string {
	return abbreviation ? `${formatted} ${abbreviation}` : formatted;
}

/**
 * Format a date-time string for event display
 * @param dateString ISO 8601 date-time string
 * @param timeZone Optional IANA timezone to render in (e.g. the event's timezone)
 * @param withAbbreviation Append the tz abbreviation/offset (default true). Pass
 *   false on surfaces that show a separate "Times shown in …" label instead.
 * @returns Formatted date string (e.g., "Fri, Oct 20 • 8:00 PM GMT+1")
 */
export function formatEventDate(
	dateString: string,
	timeZone?: string,
	withAbbreviation = true
): string {
	const date = new Date(dateString);
	const locale = getCurrentLocale();

	const dayOfWeek = date.toLocaleDateString(locale, { weekday: 'short', ...tzOpt(timeZone) });
	const month = date.toLocaleDateString(locale, { month: 'short', ...tzOpt(timeZone) });
	const day = dayOfMonthInZone(date, locale, timeZone);
	const time = date.toLocaleTimeString(locale, {
		hour: 'numeric',
		minute: '2-digit',
		hour12: locale === 'en-US', // Only use 12-hour format for English
		...tzOpt(timeZone)
	});

	const base = `${dayOfWeek}, ${month} ${day} • ${time}`;
	return withAbbreviation ? withTz(base, getTimeZoneAbbreviation(date, locale, timeZone)) : base;
}

/**
 * Format a date range for event display
 * @param startString ISO 8601 start date-time string
 * @param endString ISO 8601 end date-time string
 * @param timeZone Optional IANA timezone to render in (e.g. the event's timezone)
 * @param withAbbreviation Append the tz abbreviation/offset (default true). Pass
 *   false on surfaces that show a separate "Times shown in …" label instead.
 * @returns Formatted date range (e.g., "Fri, Oct 20 • 8:00 PM - 11:00 PM GMT+1")
 */
export function formatEventDateRange(
	startString: string,
	endString: string,
	timeZone?: string,
	withAbbreviation = true
): string {
	const start = new Date(startString);
	const end = new Date(endString);
	const locale = getCurrentLocale();

	const dayOfWeek = start.toLocaleDateString(locale, { weekday: 'short', ...tzOpt(timeZone) });
	const month = start.toLocaleDateString(locale, { month: 'short', ...tzOpt(timeZone) });
	const day = dayOfMonthInZone(start, locale, timeZone);

	const startTime = start.toLocaleTimeString(locale, {
		hour: 'numeric',
		minute: '2-digit',
		hour12: locale === 'en-US',
		...tzOpt(timeZone)
	});
	const endTime = end.toLocaleTimeString(locale, {
		hour: 'numeric',
		minute: '2-digit',
		hour12: locale === 'en-US',
		...tzOpt(timeZone)
	});

	const tz = withAbbreviation ? getTimeZoneAbbreviation(start, locale, timeZone) : '';

	// If same day, show date once
	if (isSameDayInZone(start, end, timeZone)) {
		return withTz(`${dayOfWeek}, ${month} ${day} • ${startTime} - ${endTime}`, tz);
	}

	// Different days
	const endDayOfWeek = end.toLocaleDateString(locale, { weekday: 'short', ...tzOpt(timeZone) });
	const endMonth = end.toLocaleDateString(locale, { month: 'short', ...tzOpt(timeZone) });
	const endDay = dayOfMonthInZone(end, locale, timeZone);

	return withTz(
		`${dayOfWeek}, ${month} ${day} • ${startTime} - ${endDayOfWeek}, ${endMonth} ${endDay} • ${endTime}`,
		tz
	);
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
 * Format an ISO datetime as a locale-aware relative time phrase.
 *
 * Future times read "in 3 days" / "in 2 hours"; past times read
 * "2 hours ago" / "yesterday". Uses Intl.RelativeTimeFormat so the
 * directional word ("in" / "ago" and its translations) is supplied by
 * the active locale rather than hardcoded.
 *
 * @param dateString ISO 8601 date-time string
 * @returns Relative phrase (e.g., "in 3 days", "2 hours ago")
 */
export function formatRelativeTime(dateString: string): string {
	const diffMs = new Date(dateString).getTime() - Date.now();
	const rtf = new Intl.RelativeTimeFormat(getCurrentLocale(), { numeric: 'auto' });

	const units: [Intl.RelativeTimeFormatUnit, number][] = [
		['year', 1000 * 60 * 60 * 24 * 365],
		['month', 1000 * 60 * 60 * 24 * 30],
		['day', 1000 * 60 * 60 * 24],
		['hour', 1000 * 60 * 60],
		['minute', 1000 * 60]
	];

	for (const [unit, ms] of units) {
		if (Math.abs(diffMs) >= ms) {
			return rtf.format(Math.round(diffMs / ms), unit);
		}
	}
	return rtf.format(Math.round(diffMs / 1000), 'second');
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
 * @param timeZone Optional IANA timezone to render in (e.g. the event's timezone);
 *   when supplied, the tz abbreviation is appended (e.g. "… at 8:00 PM CET")
 * @returns Verbose date string (e.g., "Friday, October 20th, 2025 at 8:00 PM CET")
 */
export function formatEventDateForScreenReader(dateString: string, timeZone?: string): string {
	const date = new Date(dateString);
	const locale = getCurrentLocale();

	const dayOfWeek = date.toLocaleDateString(locale, { weekday: 'long', ...tzOpt(timeZone) });
	const month = date.toLocaleDateString(locale, { month: 'long', ...tzOpt(timeZone) });
	const day = Number(date.toLocaleDateString('en-US', { day: 'numeric', ...tzOpt(timeZone) }));
	const year = date.toLocaleDateString('en-US', { year: 'numeric', ...tzOpt(timeZone) });
	const time = date.toLocaleTimeString(locale, {
		hour: 'numeric',
		minute: '2-digit',
		hour12: locale === 'en-US',
		...tzOpt(timeZone)
	});
	const tz = getTimeZoneAbbreviation(date, locale, timeZone);

	// Add ordinal suffix (st, nd, rd, th) - only for English
	if (locale === 'en-US') {
		const ordinal = getOrdinalSuffix(day);
		return withTz(`${dayOfWeek}, ${month} ${day}${ordinal}, ${year} at ${time}`, tz);
	}

	// For other locales, use standard format
	return withTz(`${dayOfWeek}, ${day} ${month} ${year} ${time}`, tz);
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
export function formatDateTime(dateString: string, timeZone?: string): string {
	const date = new Date(dateString);
	const locale = getCurrentLocale();

	const formatted = date.toLocaleString(locale, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		hour12: locale === 'en-US',
		...tzOpt(timeZone)
	});

	return withTz(formatted, getTimeZoneAbbreviation(date, locale, timeZone));
}

/**
 * Format a date without time for display
 * @param dateString ISO 8601 date-time string
 * @returns Formatted date string (e.g., "Oct 20, 2025" for en-US or "20. Okt. 2025" for de-DE)
 */
export function formatDate(dateString: string, timeZone?: string): string {
	const date = new Date(dateString);
	const locale = getCurrentLocale();

	// Date-only: apply the timezone so the calendar day is correct, but don't
	// append a tz abbreviation (it reads oddly next to a date with no time).
	return date.toLocaleDateString(locale, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		...tzOpt(timeZone)
	});
}

/**
 * Human label naming the timezone an event's times are shown in, e.g.
 * "London (GMT+1)". Pair it with abbreviation-free times (pass
 * `withAbbreviation: false` to the formatters) so a viewer understands the
 * times are the event's local times, not their own — without a separate
 * disclaimer.
 * @param referenceString ISO 8601 instant used to resolve the (DST-aware) offset
 * @param timeZone IANA timezone (e.g. the event's timezone)
 * @param place Optional human place name (e.g. the event's city); falls back to
 *   the IANA zone's last segment ("Europe/London" → "London")
 * @returns e.g. "London (GMT+1)", or just the offset when no place resolves
 */
export function formatEventTimezoneLabel(
	referenceString: string,
	timeZone: string,
	place?: string | null
): string {
	const locale = getCurrentLocale();
	const offset = getTimeZoneAbbreviation(new Date(referenceString), locale, timeZone);
	const name = place?.trim() || timeZone.split('/').pop()?.replace(/_/g, ' ') || timeZone;
	return offset ? `${name} (${offset})` : name;
}
