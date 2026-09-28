/**
 * Per-tier check-in windows (#945, backend #994).
 *
 * The backend stores a tier's check-in window as two nullable ISO 8601
 * durations relative to the event START (`check_in_opens_offset`,
 * `check_in_closes_offset`), and applies them in the event's local wall-clock
 * time — so "+1 day" from Saturday 10:00 is Sunday 10:00 even across a DST
 * change. The tier form lets organizers pick an absolute date/time instead, so
 * these helpers convert between a picked `datetime-local` value and an offset.
 *
 * All arithmetic here is WALL-CLOCK arithmetic on `datetime-local` strings
 * ("YYYY-MM-DDTHH:mm"): both strings are read as if they were UTC, so no
 * browser timezone or DST rule ever enters the calculation. That mirrors the
 * backend exactly, and matches every other admin picker (event start, sales
 * window), which are also naive local strings.
 */

/** Backend bound: each offset must be within ±364 days of the event start. */
export const MAX_OFFSET_MINUTES = 364 * 24 * 60;

const MINUTES_PER_DAY = 24 * 60;

/**
 * Parse an ISO 8601 duration into signed whole minutes, or `null` when the
 * value is empty or unreadable.
 *
 * Handles Django's long form (`-P0DT01H00M00S`, `P1DT02H00M00S`) as well as the
 * short forms the API accepts (`PT2H`, `-PT30M`, `P1DT2H`, `P1W`). Years and
 * months are rejected: the backend never emits them within its ±364-day bound,
 * and they have no fixed length in minutes. Seconds are rounded to the nearest
 * minute, the picker's resolution.
 */
export function parseIsoDuration(value: string | null | undefined): number | null {
	if (!value) return null;
	const match =
		/^([+-])?P(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(
			value.trim()
		);
	if (!match) return null;
	const [, sign, weeks, days, hours, minutes, seconds] = match;
	// "P" or "PT" alone carries no component and is not a valid duration.
	if ([weeks, days, hours, minutes, seconds].every((part) => part === undefined)) return null;
	const num = (part: string | undefined): number => (part ? parseFloat(part) : 0);
	const total =
		num(weeks) * 7 * MINUTES_PER_DAY +
		num(days) * MINUTES_PER_DAY +
		num(hours) * 60 +
		num(minutes) +
		num(seconds) / 60;
	const rounded = Math.round(total);
	// Normalise -0 so callers can compare with `=== 0`.
	return sign === '-' && rounded !== 0 ? -rounded : rounded;
}

/** Format signed minutes as a compact ISO 8601 duration (`-PT1H`, `P1DT2H30M`, `PT0S`). */
export function formatIsoDuration(totalMinutes: number): string {
	const sign = totalMinutes < 0 ? '-' : '';
	const { days, hours, minutes } = splitMinutes(totalMinutes);
	if (days === 0 && hours === 0 && minutes === 0) return 'PT0S';
	const datePart = days ? `${days}D` : '';
	const timePart = (hours ? `${hours}H` : '') + (minutes ? `${minutes}M` : '');
	return `${sign}P${datePart}${timePart ? `T${timePart}` : ''}`;
}

/** Split the magnitude of signed minutes into whole days / hours / minutes. */
export function splitMinutes(totalMinutes: number): {
	days: number;
	hours: number;
	minutes: number;
} {
	const abs = Math.abs(Math.round(totalMinutes));
	return {
		days: Math.floor(abs / MINUTES_PER_DAY),
		hours: Math.floor((abs % MINUTES_PER_DAY) / 60),
		minutes: abs % 60
	};
}

/** Read a `datetime-local` value as wall-clock minutes since the epoch, or `null`. */
function wallClockMinutes(local: string | null | undefined): number | null {
	if (!local) return null;
	const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
	if (!match) return null;
	const [, y, mo, d, h, mi] = match.map(Number);
	return Date.UTC(y, mo - 1, d, h, mi) / 60_000;
}

/** Render wall-clock minutes since the epoch back into a `datetime-local` value. */
function toLocalString(minutes: number): string {
	const date = new Date(minutes * 60_000);
	const pad = (n: number): string => n.toString().padStart(2, '0');
	return (
		`${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}` +
		`T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
	);
}

/** Offset in minutes from the event start to a picked time; `null` if either is unset. */
export function offsetFromPicked(eventStartLocal: string, pickedLocal: string): number | null {
	const start = wallClockMinutes(eventStartLocal);
	const picked = wallClockMinutes(pickedLocal);
	if (start === null || picked === null) return null;
	return picked - start;
}

/** The `datetime-local` value an offset lands on; `''` when either input is unset. */
export function pickedFromOffset(
	eventStartLocal: string,
	offsetMinutes: number | null | undefined
): string {
	const start = wallClockMinutes(eventStartLocal);
	if (start === null || offsetMinutes === null || offsetMinutes === undefined) return '';
	return toLocalString(start + offsetMinutes);
}

/** Whether an offset is within the backend's ±364-day bound. */
export function isOffsetInRange(offsetMinutes: number): boolean {
	return Math.abs(offsetMinutes) <= MAX_OFFSET_MINUTES;
}

/** `min`/`max` attributes for the pickers, clamped to the backend bound. */
export function offsetPickerBounds(eventStartLocal: string): { min?: string; max?: string } {
	if (wallClockMinutes(eventStartLocal) === null) return {};
	return {
		min: pickedFromOffset(eventStartLocal, -MAX_OFFSET_MINUTES),
		max: pickedFromOffset(eventStartLocal, MAX_OFFSET_MINUTES)
	};
}

/**
 * Whether the tier's RESOLVED check-in window is empty (closes at or before it
 * opens), applying the backend's per-field fallback: tier offset → the event's
 * check-in window → event start/end. Returns `false` whenever a side can't be
 * resolved from the form (e.g. an open-ended event with no check-in end), since
 * the backend is the authority and we only want a soft warning.
 */
export function isResolvedWindowEmpty(input: {
	eventStart: string;
	eventEnd: string | null | undefined;
	eventCheckInStart: string | null | undefined;
	eventCheckInEnd: string | null | undefined;
	opensOffset: number | null;
	closesOffset: number | null;
}): boolean {
	const start = wallClockMinutes(input.eventStart);
	if (start === null) return false;
	const opens =
		input.opensOffset !== null
			? start + input.opensOffset
			: (wallClockMinutes(input.eventCheckInStart) ?? start);
	const closes =
		input.closesOffset !== null
			? start + input.closesOffset
			: (wallClockMinutes(input.eventCheckInEnd) ?? wallClockMinutes(input.eventEnd));
	if (closes === null) return false;
	return closes <= opens;
}

/** Why a picked check-in time can't be saved, or `null` when it can (or is empty). */
export function checkInPickError(
	eventStartLocal: string,
	pickedLocal: string
): 'needsEventStart' | 'outOfRange' | null {
	if (!pickedLocal) return null;
	const offset = offsetFromPicked(eventStartLocal, pickedLocal);
	if (offset === null) return 'needsEventStart';
	return isOffsetInRange(offset) ? null : 'outOfRange';
}

/**
 * The value to send for one offset field.
 *
 * - picker cleared → `null` (fall back to the event's check-in window);
 * - event start unknown → the stored value untouched, so an existing offset is
 *   never silently dropped when the form can't resolve it;
 * - unchanged to the minute → the stored string verbatim, so a sub-minute
 *   offset set through the API isn't rounded by an unrelated edit.
 */
export function checkInOffsetPayload(
	eventStartLocal: string,
	pickedLocal: string,
	stored: string | null | undefined
): string | null {
	if (!pickedLocal) return null;
	const offset = offsetFromPicked(eventStartLocal, pickedLocal);
	if (offset === null) return stored ?? null;
	if (stored && parseIsoDuration(stored) === offset) return stored;
	return formatIsoDuration(offset);
}

/** The event form's `datetime-local` values a tier's check-in offsets resolve against. */
export interface TierCheckInEventContext {
	start: string;
	end?: string | null;
	checkInStart?: string | null;
	checkInEnd?: string | null;
}

type StoredOffsets = {
	check_in_opens_offset?: string | null;
	check_in_closes_offset?: string | null;
} | null;

/** Picker values to seed the tier form with from a stored tier. */
export function initialCheckInPicks(
	eventStartLocal: string,
	tier: StoredOffsets
): { opensAt: string; closesAt: string } {
	return {
		opensAt: pickedFromOffset(eventStartLocal, parseIsoDuration(tier?.check_in_opens_offset)),
		closesAt: pickedFromOffset(eventStartLocal, parseIsoDuration(tier?.check_in_closes_offset))
	};
}

/** Both offset fields of the tier create/update payload. */
export function checkInOffsetsPayload(
	eventStartLocal: string,
	picks: { opensAt: string; closesAt: string },
	tier: StoredOffsets
): { check_in_opens_offset: string | null; check_in_closes_offset: string | null } {
	return {
		check_in_opens_offset: checkInOffsetPayload(
			eventStartLocal,
			picks.opensAt,
			tier?.check_in_opens_offset
		),
		check_in_closes_offset: checkInOffsetPayload(
			eventStartLocal,
			picks.closesAt,
			tier?.check_in_closes_offset
		)
	};
}

/** Whether both picks can be saved (empty picks always can). */
export function checkInPicksValid(
	eventStartLocal: string,
	picks: { opensAt: string; closesAt: string }
): boolean {
	return (
		checkInPickError(eventStartLocal, picks.opensAt) === null &&
		checkInPickError(eventStartLocal, picks.closesAt) === null
	);
}
