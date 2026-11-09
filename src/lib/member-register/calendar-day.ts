import { formatDate } from '$lib/utils/date';

/**
 * Calendar-day helpers for the member register's "members on date" picker.
 *
 * A calendar day is a plain `YYYY-MM-DD` string. It is NEVER parsed into a
 * local-time Date and never sent with a time or an offset: the backend reads it
 * as a day in the ORGANIZATION's timezone (local midnight to local midnight),
 * so converting through the browser timezone would shift it by a day for any
 * viewer east or west of the organization.
 */

const CALENDAR_DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real `YYYY-MM-DD` calendar day (rejects `2026-02-30`, times, offsets). */
export function isCalendarDay(value: string | null | undefined): value is string {
	if (!value) return false;
	const match = CALENDAR_DAY_RE.exec(value);
	if (!match) return false;
	const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
	if (year < 1) return false;
	// Round-trip in UTC: no host-timezone involvement.
	const probe = new Date(0);
	probe.setUTCFullYear(year, month - 1, day);
	return (
		probe.getUTCFullYear() === year &&
		probe.getUTCMonth() === month - 1 &&
		probe.getUTCDate() === day
	);
}

/**
 * Human readback of a calendar day with a textual month in the UI language
 * ("12 Mar 2026" / "Mar 12, 2026"). The day is rendered as UTC midnight in the
 * UTC zone, so the host timezone cannot move it. Returns "" for invalid input.
 */
export function formatCalendarDay(day: string | null | undefined): string {
	if (!isCalendarDay(day)) return '';
	return formatDate(`${day}T00:00:00Z`, 'UTC');
}

export const PICKABLE_YEAR_MIN = 1900;
export const PICKABLE_YEAR_MAX = 2100;

/**
 * True for a complete real calendar day whose year is plausible for a register
 * filter. Guards against the half-typed years (`0002-03-12`) a native date input
 * emits while the user is still typing.
 */
export function isPickableDay(value: string | null | undefined): value is string {
	if (!isCalendarDay(value)) return false;
	const year = Number(value.slice(0, 4));
	return year >= PICKABLE_YEAR_MIN && year <= PICKABLE_YEAR_MAX;
}

/**
 * Today's calendar day (`YYYY-MM-DD`) in an IANA timezone: what "today" is on
 * the organization's wall clock, whatever the viewer's own zone. Falls back to
 * the browser's zone for a missing or unknown name. Machine format, never shown.
 */
export function calendarDayInZone(
	timezone: string | null | undefined,
	now: Date = new Date()
): string {
	const format = (zone: string | undefined): string => {
		const parts = new Intl.DateTimeFormat('en-US', {
			timeZone: zone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit'
		}).formatToParts(now);
		const get = (type: string): string => parts.find((part) => part.type === type)?.value ?? '';
		return `${get('year').padStart(4, '0')}-${get('month')}-${get('day')}`;
	};
	try {
		return format(timezone || undefined);
	} catch {
		return format(undefined);
	}
}
