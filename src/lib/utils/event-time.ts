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
	getTimeZoneAbbreviation,
	getUtcOffsetKey,
	formatTimeOfDay,
	formatEventDate,
	formatEventDateRange
} from '$lib/utils/date';

function viewerTimeZone(): string {
	return Intl.DateTimeFormat().resolvedOptions().timeZone;
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
		return getUtcOffsetKey(date, timeZone) !== getUtcOffsetKey(date, viewerZone);
	} catch {
		return false;
	}
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
	try {
		const time = formatTimeOfDay(dateString, timeZone);
		if (!eventZoneDiffersFromViewer(dateString, timeZone, viewerZone)) return time;
		const abbr = getTimeZoneAbbreviation(new Date(dateString), getDateLocale(), timeZone);
		return abbr ? `${time} ${abbr}` : time;
	} catch (e) {
		if (!(e instanceof RangeError)) throw e;
		// Zone unknown to this browser's ICU: fall back to the viewer zone, no label.
		return formatTimeOfDay(dateString, viewerZone);
	}
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
	try {
		const startDiffers = eventZoneDiffersFromViewer(start, tz, viewerZone);
		if (isOpenEnded || !end) {
			return formatEventDate(start, tz, startDiffers);
		}
		// A range can cross a DST change, so the end may differ even when the start does not.
		const showTz = startDiffers || eventZoneDiffersFromViewer(end, tz, viewerZone);
		return formatEventDateRange(start, end, tz, showTz);
	} catch (e) {
		if (!(e instanceof RangeError)) throw e;
		// Zone unknown to this browser's ICU: fall back to the viewer zone, no label.
		return isOpenEnded || !end
			? formatEventDate(start, viewerZone, false)
			: formatEventDateRange(start, end, viewerZone, false);
	}
}
