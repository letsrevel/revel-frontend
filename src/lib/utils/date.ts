/**
 * Date and time formatting utilities for event display
 */

import { getLocale } from '$lib/paraglide/runtime.js';

/**
 * Maps the active Paraglide UI language to a BCP 47 date locale.
 *
 * Invariant: every mapped locale renders a *textual* month for the
 * `month: 'short'` skeletons used throughout this file (guarded by a test).
 *
 * pt deliberately maps to pt-BR, not pt-PT: pt-PT's CLDR data resolves the
 * short-month-with-day skeletons (MMMd → "d/MM", yMMMd → "dd/MM/y") to
 * *numeric* patterns — Portugal's editorial convention for medium-length
 * dates — so `formatEventDate` would render "sexta, 24/10" where every other
 * locale shows a month word. The language material is identical between the
 * two (same month/weekday names, same "de … de …" construction, same "às"
 * connector); pt-BR differs only in preferring textual medium dates
 * ("sex., 24 de out.") and three-letter weekday abbreviations ("sex." vs
 * pt-PT "sexta") — natural, fully intelligible Portuguese for either
 * audience, and consistent with the app-wide "month is always a word" intent
 * (cf. formatDateTimeReadback).
 */
const LOCALE_MAP: Record<string, string> = {
	en: 'en-US',
	de: 'de-DE',
	it: 'it-IT',
	fr: 'fr-FR',
	es: 'es-ES',
	pt: 'pt-BR'
};

/**
 * UI languages with an explicit locale mapping, derived from LOCALE_MAP.
 * Exported so tests can iterate the supported set without hand-maintaining
 * a parallel list.
 */
export const SUPPORTED_UI_LANGUAGES: readonly string[] = Object.keys(LOCALE_MAP);

/**
 * Get the active UI language as a BCP 47 date locale (e.g. "en-US", "de-DE",
 * "it-IT", "fr-FR"). Drives every human-facing date in the app, so switching
 * the UI language switches month names. Exported so calendar.ts shares it.
 */
export function getDateLocale(): string {
	return LOCALE_MAP[getLocale()] || 'en-US';
}

/**
 * Locale-appropriate range separator for the hand-built range branches (the
 * DST-straddling cases where formatRange can't be used because each end
 * carries its own offset). En dash with spaces matches what formatRange
 * produces for the supported locales, so normal and DST ranges read alike.
 */
const RANGE_SEPARATOR = ' \u2013 ';

/**
 * CLDR-derived spoken time suffix (de: " Uhr"), used by the screen-reader
 * format.
 *
 * CLDR's single-instant time patterns carry no time word (de renders bare
 * "20:00"), but its *interval* patterns do: de formats a range as
 * "20:00–23:00 Uhr". Probe the locale's interval pattern once and reuse its
 * trailing shared suffix for single times — but only when that tail is purely
 * literal. A tail containing a real field is a collapsed shared component,
 * not a time word (en collapses the day period: "8:00 – 11:00 PM"), and the
 * single format already renders that field itself.
 *
 * Probed with two same-day-period instants pinned to UTC so the result
 * depends on locale data only, never on the viewer's timezone. Cached per
 * locale. Hardcodes no language: any locale whose CLDR interval data carries
 * a literal time word gets it automatically.
 */
const spokenTimeSuffixCache = new Map<string, string>();

function getSpokenTimeSuffix(locale: string): string {
	const cached = spokenTimeSuffixCache.get(locale);
	if (cached !== undefined) return cached;

	const parts = getFormatter(locale, {
		hour: 'numeric',
		minute: '2-digit',
		timeZone: 'UTC'
	}).formatRangeToParts(
		new Date(Date.UTC(2024, 0, 1, 13, 0)),
		new Date(Date.UTC(2024, 0, 1, 14, 0))
	);

	const lastEnd = parts.map((p) => p.source).lastIndexOf('endRange');
	const tail = parts.slice(lastEnd + 1);
	const suffix =
		tail.length > 0 && tail.every((p) => p.type === 'literal')
			? tail.map((p) => p.value).join('')
			: '';

	spokenTimeSuffixCache.set(locale, suffix);
	return suffix;
}

/**
 * Memoized Intl.DateTimeFormat instances. Constructing a formatter is
 * expensive (ICU data lookup); event lists render dozens of dates with the
 * same locale/timezone/options, so cache by a stable key. Option objects
 * below are built with literal, fixed key order, so JSON.stringify is a
 * stable cache key.
 */
const dtfCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
	const key = `${locale}|${JSON.stringify(options)}`;
	let formatter = dtfCache.get(key);
	if (!formatter) {
		formatter = new Intl.DateTimeFormat(locale, options);
		dtfCache.set(key, formatter);
	}
	return formatter;
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
	const parts = getFormatter(locale, {
		timeZone,
		timeZoneName: 'short'
	}).formatToParts(date);
	return parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
}

/**
 * Whether two instants land on the same calendar day in the given timezone.
 * Uses en-CA (ISO-like YYYY-MM-DD) for a stable, locale-independent compare.
 */
function isSameDayInZone(a: Date, b: Date, timeZone?: string): boolean {
	const formatter = getFormatter('en-CA', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		...tzOpt(timeZone)
	});
	return formatter.format(a) === formatter.format(b);
}

/**
 * Append a timezone abbreviation to a formatted time string when present.
 */
function withTz(formatted: string, abbreviation: string): string {
	return abbreviation ? `${formatted} ${abbreviation}` : formatted;
}

/**
 * Format a date-time string for event display with locale-aware date ordering,
 * punctuation, and time formats (e.g. "Fri, Oct 20 • 8:00 PM GMT+1" in en-US,
 * "Fr., 20. Okt. • 20:00 MEZ" in de-DE). Hour cycle (12h/24h) is decided by
 * the locale, not hardcoded.
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
	const locale = getDateLocale();

	const dateFormatter = getFormatter(locale, {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		...tzOpt(timeZone)
	});
	const timeFormatter = getFormatter(locale, {
		hour: 'numeric',
		minute: '2-digit',
		...tzOpt(timeZone)
	});

	const base = `${dateFormatter.format(date)} • ${timeFormatter.format(date)}`;
	return withAbbreviation ? withTz(base, getTimeZoneAbbreviation(date, locale, timeZone)) : base;
}

/**
 * Format a date range for event display
 * @param startString ISO 8601 start date-time string
 * @param endString ISO 8601 end date-time string
 * @param timeZone Optional IANA timezone to render in (e.g. the event's timezone)
 * @param withAbbreviation Append the tz abbreviation/offset (default true). Pass
 *   false on surfaces that show a separate "Times shown in …" label instead.
 * @returns Formatted date range (e.g., "Fri, Oct 20 • 8:00 – 11:00 PM GMT+1")
 */
export function formatEventDateRange(
	startString: string,
	endString: string,
	timeZone?: string,
	withAbbreviation = true
): string {
	const start = new Date(startString);
	const end = new Date(endString);
	const locale = getDateLocale();

	const dateFormatter = getFormatter(locale, {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		...tzOpt(timeZone)
	});
	const timeFormatter = getFormatter(locale, {
		hour: 'numeric',
		minute: '2-digit',
		...tzOpt(timeZone)
	});

	const startTz = withAbbreviation ? getTimeZoneAbbreviation(start, locale, timeZone) : '';
	const endTz = withAbbreviation ? getTimeZoneAbbreviation(end, locale, timeZone) : '';

	// If same day, show date once. A same-local-day range can still straddle a
	// DST transition (fall-back: e.g. 01:00 GMT+2 → 12:00 GMT+1 on the same
	// calendar day), in which case each time carries its own offset. Otherwise
	// formatRange renders the span with locale-appropriate punctuation and
	// collapsing (e.g. "8:00 – 11:00 PM" in en-US, "20:00–23:00" in de-DE).
	if (isSameDayInZone(start, end, timeZone)) {
		if (startTz !== endTz) {
			return `${dateFormatter.format(start)} • ${withTz(timeFormatter.format(start), startTz)}${RANGE_SEPARATOR}${withTz(timeFormatter.format(end), endTz)}`;
		}
		return withTz(
			`${dateFormatter.format(start)} • ${timeFormatter.formatRange(start, end)}`,
			startTz
		);
	}

	// Different days

	// A multi-day range can straddle a DST transition, in which case start and
	// end have different abbreviations/offsets (e.g. GMT+1 → GMT+2). Append each
	// to its own time so the end isn't mislabelled with the start's offset; when
	// they match, append once at the end as before.
	if (startTz !== endTz) {
		return `${dateFormatter.format(start)} • ${withTz(timeFormatter.format(start), startTz)}${RANGE_SEPARATOR}${dateFormatter.format(end)} • ${withTz(timeFormatter.format(end), endTz)}`;
	}

	return withTz(
		`${dateFormatter.format(start)} • ${timeFormatter.format(start)}${RANGE_SEPARATOR}${dateFormatter.format(end)} • ${timeFormatter.format(end)}`,
		startTz
	);
}

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * Signed number of calendar-day boundaries (midnights) between two instants
 * in the given timezone — 0 for the same local day, 1 for "tomorrow", 2 for
 * "the day after tomorrow", regardless of the clock times involved.
 *
 * Reads each instant's local Y-M-D via the same en-CA (YYYY-MM-DD) formatter
 * trick as isSameDayInZone, then differences them as UTC midnights — exact
 * arithmetic, immune to the DST offset shifts that make dividing raw
 * epoch-millisecond differences by 24h drift near transitions.
 */
function calendarDaysBetween(from: Date, to: Date, timeZone?: string): number {
	const formatter = getFormatter('en-CA', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		...tzOpt(timeZone)
	});
	const utcMidnight = (d: Date): number => {
		const [year, month, day] = formatter.format(d).split('-').map(Number);
		return Date.UTC(year, month - 1, day);
	};
	return Math.round((utcMidnight(to) - utcMidnight(from)) / DAY_MS);
}

/**
 * Unit ladder for relative phrases, largest first. An instant qualifies for
 * the first unit whose span it meets or exceeds; below every threshold the
 * caller-chosen floor unit applies. Month/year spans are calendar
 * approximations (30/365 days) — adequate for casual UI copy, not for exact
 * anniversary arithmetic.
 */
const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
	['year', 365 * DAY_MS],
	['month', 30 * DAY_MS],
	['day', DAY_MS],
	['hour', HOUR_MS],
	['minute', MINUTE_MS]
];

/**
 * Shared core of formatRelativeTime and getRSVPDeadlineRelative: a
 * locale-aware relative phrase for an instant, measured against now.
 *
 * Uses Intl.RelativeTimeFormat with numeric: 'auto', so single-step values
 * become the locale's idiom where one exists ("tomorrow" / "morgen",
 * "übermorgen" for +2 days in German, "yesterday", "next month") instead of
 * "in 1 day".
 *
 * The day unit counts *calendar days* (midnights crossed in the given
 * timezone), not 24-hour blocks: an instant on the day after tomorrow reads
 * "in 2 days" even when fewer than 48 elapsed hours away, matching how
 * people count days against a calendar. Below 24 elapsed hours the hour unit
 * applies, even across a midnight. When DST fall-back fits a ≥24h span into
 * a single 25-hour local day (zero midnights crossed), the phrase falls back
 * to hours — a day phrase would be either nonsense ("in 0 days") or false
 * ("tomorrow" for a same-day instant).
 *
 * @param target The instant to describe
 * @param timeZone Optional IANA timezone the calendar-day boundary is judged
 *   in; defaults to the viewer's timezone
 * @param minUnit Floor unit for tiny spans: 'second' renders "in 30 seconds",
 *   'minute' clamps to "in 1 minute" for surfaces where seconds-level copy
 *   would be noise
 */
function formatRelativeToNow(
	target: Date,
	timeZone: string | undefined,
	minUnit: 'second' | 'minute'
): string {
	const now = new Date();
	const diffMs = target.getTime() - now.getTime();

	// Invalid input (e.g. an unparseable date string) yields a NaN diff, which
	// Intl.RelativeTimeFormat.format() rejects with a RangeError. Return "" —
	// the same empty result formatDateTimeReadback uses for invalid input — so
	// callers can render nothing instead of crashing.
	if (!Number.isFinite(diffMs)) {
		return '';
	}

	const rtf = new Intl.RelativeTimeFormat(getDateLocale(), { numeric: 'auto' });

	for (const [unit, unitMs] of RELATIVE_UNITS) {
		if (Math.abs(diffMs) < unitMs) {
			continue;
		}
		if (unit === 'day') {
			const days = calendarDaysBetween(now, target, timeZone);
			if (days !== 0) {
				return rtf.format(days, 'day');
			}
			// ≥24 elapsed hours yet zero midnights crossed: DST fall-back has
			// fit the span into a single 25-hour local day. A day phrase would
			// be wrong either way ("in 0 days" is nonsense, "tomorrow" is
			// false for a same-day instant) — fall through to hours, which
			// renders the truthful "in 24 hours" / "in 25 hours".
			continue;
		}
		return rtf.format(Math.trunc(diffMs / unitMs), unit);
	}

	// Below one minute.
	if (minUnit === 'minute') {
		return rtf.format(Math.sign(diffMs), 'minute');
	}
	return rtf.format(Math.trunc(diffMs / 1000), 'second');
}

/**
 * Get a relative time description for an RSVP deadline, localized via
 * Intl.RelativeTimeFormat (see formatRelativeToNow for unit selection and
 * calendar-day semantics; a deadline seconds away is clamped to "in 1 minute"
 * rather than counting down seconds).
 *
 * @param deadlineString ISO 8601 date-time string
 * @param timeZone Optional IANA timezone the calendar-day boundary is judged
 *   in; defaults to the viewer's timezone, which is the calendar an RSVP'ing
 *   viewer plans against.
 * @returns Relative time description (e.g., "tomorrow", "in 2 days",
 *   "in 3 hours"), or null when the deadline has passed — the caller decides
 *   the "closed" copy for its surface (e.g. eventQuickInfo.rsvpClosed),
 *   keeping UI messages out of this utility.
 */
export function getRSVPDeadlineRelative(
	deadlineString: string,
	timeZone?: string
): string | null {
	const deadline = new Date(deadlineString);

	// Passed, or exactly at the deadline — "RSVP by X" means X itself is too late.
	if (deadline.getTime() - Date.now() <= 0) {
		return null;
	}

	return formatRelativeToNow(deadline, timeZone, 'minute');
}

/**
 * Format an ISO datetime as a locale-aware relative time phrase.
 *
 * Future times read "in 3 days" / "in 2 hours"; past times read
 * "2 hours ago" / "yesterday" (see formatRelativeToNow for unit selection,
 * calendar-day semantics, and the locale idioms numeric: 'auto' enables).
 *
 * @param dateString ISO 8601 date-time string
 * @param timeZone Optional IANA timezone the calendar-day boundary is judged
 *   in; defaults to the viewer's timezone
 * @returns Relative phrase (e.g., "in 3 days", "2 hours ago")
 */
export function formatRelativeTime(dateString: string, timeZone?: string): string {
	return formatRelativeToNow(new Date(dateString), timeZone, 'second');
}

/**
 * Check if an event is in the past
 * @param endString ISO 8601 end date-time string
 * @returns true if event has ended
 */
export function isEventPast(endString: string): boolean {
	const end = new Date(endString);
	return end.getTime() <= Date.now();
}

/**
 * Check if RSVP deadline has passed.
 *
 * Boundary matches getRSVPDeadlineRelative: the exact deadline instant counts
 * as closed ("RSVP by X" means X itself is too late), so a surface combining
 * both never shows an open button next to closed copy.
 * @param deadlineString ISO 8601 date-time string, null, or undefined
 * @returns true if deadline has passed
 */
export function isRSVPClosed(deadlineString: string | null | undefined): boolean {
	if (!deadlineString) return false;

	const deadline = new Date(deadlineString);
	return deadline.getTime() <= Date.now();
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
 * @returns Verbose date string (e.g., "Friday, October 20, 2025 at 8:00 PM CET")
 */
export function formatEventDateForScreenReader(dateString: string, timeZone?: string): string {
	const date = new Date(dateString);
	const locale = getDateLocale();

	// dateStyle/timeStyle produce the fully localized verbose form, including
	// the locale's own connector word ("Friday, October 20, 2025 at 8:00 PM" in
	// en-US, "Freitag, 20. Oktober 2025 um 20:00" in de-DE) — replacing the
	// previous hand-built string with an English-only ordinal suffix.
	//
	// CLDR's single-instant pattern omits the spoken time word ("20:00", never
	// "20:00 Uhr" — only the *interval* pattern carries it). That's fine
	// visually, but this string exists to be read aloud, and German times are
	// spoken "zwanzig Uhr". getSpokenTimeSuffix derives the word from the
	// locale's own CLDR interval data; when present, insert it after the
	// minute via formatToParts so it lands correctly regardless of where the
	// time sits in the locale's pattern. Locales without one take the plain
	// format() path — deliberately, since format() and joined formatToParts
	// output are not byte-identical on V8 (its NNBSP→space compatibility
	// patch applies only to format()).
	const suffix = getSpokenTimeSuffix(locale);
	const formatter = getFormatter(locale, {
		dateStyle: 'full',
		timeStyle: 'short',
		...tzOpt(timeZone)
	});

	const formatted = suffix
		? formatter
				.formatToParts(date)
				.map((p) => (p.type === 'minute' ? p.value + suffix : p.value))
				.join('')
		: formatter.format(date);

	return withTz(formatted, getTimeZoneAbbreviation(date, locale, timeZone));
}

/**
 * Format only the time-of-day for an instant, in an optional timezone.
 *
 * Used by the event schedule/timeline where the calendar day is implied by the
 * event itself, so only the clock time needs rendering. No tz abbreviation is
 * appended — the schedule shows the event's timezone once, in a shared label.
 *
 * @param dateString ISO 8601 date-time string
 * @param timeZone Optional IANA timezone to render in (e.g. the event's timezone)
 * @returns Formatted time string (e.g., "8:00 PM" for en-US or "20:00" for de-DE)
 */
export function formatTimeOfDay(dateString: string, timeZone?: string): string {
	return getFormatter(getDateLocale(), {
		hour: 'numeric',
		minute: '2-digit',
		...tzOpt(timeZone)
	}).format(new Date(dateString));
}

/**
 * Format a date for display in admin pages and lists
 * Uses locale-aware formatting with medium date and short time
 * @param date ISO 8601 date-time string, or an already-parsed Date (lets
 *   callers that validated the value avoid a second parse)
 * @returns Formatted date string (e.g., "Oct 20, 2025, 8:00 PM" for en-US or "20. Okt. 2025, 20:00" for de-DE)
 */
export function formatDateTime(date: string | Date, timeZone?: string): string {
	const parsed = date instanceof Date ? date : new Date(date);
	const locale = getDateLocale();

	const formatted = getFormatter(locale, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		...tzOpt(timeZone)
	}).format(parsed);

	return withTz(formatted, getTimeZoneAbbreviation(parsed, locale, timeZone));
}

/**
 * Unambiguous textual readback of a datetime input value, shown under a native
 * <input type="datetime-local"> (whose own display is browser-locale numeric and
 * cannot be restyled). Month is always textual, in the active UI language.
 *
 * Accepts a datetime-local string ("2026-06-07T19:00", parsed as local wall
 * time) or a full ISO 8601 string. Returns "" for empty/invalid input so callers
 * can render nothing before a value is picked.
 *
 * @param value datetime-local or ISO 8601 string (may be empty/null/undefined)
 * @returns e.g. "Oct 20, 2025, 2:30 PM" (locale-dependent), or ""
 */
export function formatDateTimeReadback(value: string | null | undefined): string {
	if (!value) return '';
	const date = new Date(value);
	if (isNaN(date.getTime())) return '';
	return formatDateTime(date);
}

/**
 * Format a date without time for display
 * @param dateString ISO 8601 date-time string
 * @returns Formatted date string (e.g., "Oct 20, 2025" for en-US or "20. Okt. 2025" for de-DE)
 */
export function formatDate(dateString: string, timeZone?: string): string {
	// Date-only: apply the timezone so the calendar day is correct, but don't
	// append a tz abbreviation (it reads oddly next to a date with no time).
	return getFormatter(getDateLocale(), {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		...tzOpt(timeZone)
	}).format(new Date(dateString));
}

/** Long-month date, no time, e.g. "October 20, 2025". */
export function formatDateLongMonth(dateString: string, timeZone?: string): string {
	return getFormatter(getDateLocale(), {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		...tzOpt(timeZone)
	}).format(new Date(dateString));
}

/** Long-month date + time, e.g. "October 20, 2025, 8:00 PM". */
export function formatDateTimeVerbose(dateString: string, timeZone?: string): string {
	return getFormatter(getDateLocale(), {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		...tzOpt(timeZone)
	}).format(new Date(dateString));
}

/** Month + year only, e.g. "October 2025". */
export function formatMonthYearLabel(dateString: string, timeZone?: string): string {
	return getFormatter(getDateLocale(), {
		year: 'numeric',
		month: 'long',
		...tzOpt(timeZone)
	}).format(new Date(dateString));
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
 * @returns e.g. "London (GMT+1)", or just the place name when no offset is available
 */
export function formatEventTimezoneLabel(
	referenceString: string,
	timeZone: string,
	place?: string | null
): string {
	const locale = getDateLocale();
	const offset = getTimeZoneAbbreviation(new Date(referenceString), locale, timeZone);
	const name = place?.trim() || timeZone.split('/').pop()?.replace(/_/g, ' ') || timeZone;
	return offset ? `${name} (${offset})` : name;
}
