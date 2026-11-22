/**
 * Event-timezone display helpers for the calendar surfaces.
 *
 * Kept out of date.ts (at its per-file length cap). Times render in the
 * event's own timezone; the zone abbreviation is appended only when the
 * event's offset at that instant differs from the viewer's, so a viewer in
 * Berlin looking at a Vienna event sees no label.
 */
import {
	getDateLocale,
	formatTimeOfDay,
	formatEventDate,
	formatEventDateRange
} from '$lib/utils/date';

function viewerTimeZone(): string {
	return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function offsetKey(date: Date, timeZone: string): string {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		timeZoneName: 'longOffset'
	}).formatToParts(date);
	return parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
}

/**
 * True when `timeZone` has a different UTC offset than the viewer's zone at
 * the given instant. Missing/invalid zones return false (nothing to label).
 */
export function eventZoneDiffersFromViewer(
	dateString: string,
	timeZone?: string | null,
	viewerZone: string = viewerTimeZone()
): boolean {
	if (!timeZone) return false;
	try {
		const date = new Date(dateString);
		return offsetKey(date, timeZone) !== offsetKey(date, viewerZone);
	} catch {
		return false;
	}
}

function shortAbbreviation(dateString: string, timeZone: string): string {
	const parts = new Intl.DateTimeFormat(getDateLocale(), {
		timeZone,
		timeZoneName: 'short'
	}).formatToParts(new Date(dateString));
	return parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
}

/**
 * Time of day in the event's timezone ("8:00 PM"), with the short zone
 * abbreviation appended only when it differs from the viewer's ("8:00 PM GMT+1").
 */
export function formatEventTimeLabel(
	dateString: string,
	timeZone?: string | null,
	viewerZone: string = viewerTimeZone()
): string {
	if (!timeZone) return formatTimeOfDay(dateString);
	const time = formatTimeOfDay(dateString, timeZone);
	if (!eventZoneDiffersFromViewer(dateString, timeZone, viewerZone)) return time;
	const abbr = shortAbbreviation(dateString, timeZone);
	return abbr ? `${time} ${abbr}` : time;
}

/**
 * Date range for the popup: event timezone, end date shown for multi-day
 * events, tz abbreviation only when it differs from the viewer's. Open-ended
 * events (or no end) show the start date and time only.
 */
export function formatEventRangeLabel(
	start: string,
	end: string | null | undefined,
	isOpenEnded: boolean | null | undefined,
	timeZone?: string | null,
	viewerZone: string = viewerTimeZone()
): string {
	const tz = timeZone || undefined;
	const showTz = eventZoneDiffersFromViewer(start, tz, viewerZone);
	if (isOpenEnded || !end) {
		return formatEventDate(start, tz, showTz);
	}
	return formatEventDateRange(start, end, tz, showTz);
}
