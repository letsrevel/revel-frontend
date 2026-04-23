import type {
	BoundaryKind,
	RecurrenceDescriptor,
	Weekday,
	WeekdayOrdinal
} from '$lib/types/recurrence';

// --- weekday / ordinal labels ----------------------------------------------

// Locale-independent 3-letter English labels. Locale-aware labels can be
// added later via `Intl.DateTimeFormat` once paraglide keys land.
const WEEKDAY_SHORT_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const WEEKDAY_LONG_EN = [
	'Monday',
	'Tuesday',
	'Wednesday',
	'Thursday',
	'Friday',
	'Saturday',
	'Sunday'
] as const;

export function weekdayLabel(n: number, style: 'short' | 'long' = 'long'): string {
	if (!Number.isInteger(n) || n < 0 || n > 6) {
		throw new RangeError(`weekdayLabel expects 0..6, got ${n}`);
	}
	return (style === 'short' ? WEEKDAY_SHORT_EN : WEEKDAY_LONG_EN)[n as Weekday];
}

export function ordinalLabel(n: number): string {
	if (n === -1) return 'last';
	if (n === 1) return 'first';
	if (n === 2) return 'second';
	if (n === 3) return 'third';
	if (n === 4) return 'fourth';
	throw new RangeError(`ordinalLabel expects 1..4 or -1, got ${n}`);
}

// Converts 1/2/3/... into "1st", "2nd", "3rd", "4th", etc. Used for "the 15th
// of every month" rendering. English-only for now.
function ordinalSuffixEn(day: number): string {
	const mod100 = day % 100;
	if (mod100 >= 11 && mod100 <= 13) return `${day}th`;
	switch (day % 10) {
		case 1:
			return `${day}st`;
		case 2:
			return `${day}nd`;
		case 3:
			return `${day}rd`;
		default:
			return `${day}th`;
	}
}

// --- formatRecurrence ------------------------------------------------------

export interface FormatRecurrenceOptions {
	locale?: string;
	includeBoundary?: boolean;
}

// Returns a human-readable summary like
//   "Every Monday"
//   "Every 2 weeks on Tuesday and Thursday"
//   "The 15th of every month"
//   "The second Tuesday of every month"
//   "Every day"
//   "Every 3 days"
//   "… until 31 December 2026"
//   "… for 12 occurrences"
//
// Locale parameter is plumbed through for future paraglide-backed i18n; the
// current implementation is English-only. The boundary suffix is appended when
// `includeBoundary` (default true) and the rule has one.
export function formatRecurrence(
	rule: RecurrenceDescriptor,
	options: FormatRecurrenceOptions = {}
): string {
	const { locale = 'en', includeBoundary = true } = options;
	const head = formatCadence(rule, locale);
	if (!includeBoundary) return head;
	const boundary = formatBoundary(rule, locale);
	return boundary ? `${head} ${boundary}` : head;
}

function formatCadence(rule: RecurrenceDescriptor, locale: string): string {
	const interval = Math.max(1, rule.interval ?? 1);
	switch (rule.frequency) {
		case 'daily':
			return interval === 1 ? 'Every day' : `Every ${interval} days`;
		case 'weekly':
			return formatWeekly(rule, interval);
		case 'monthly':
			return formatMonthly(rule, interval, locale);
		case 'yearly':
			return interval === 1 ? 'Every year' : `Every ${interval} years`;
		default: {
			// Exhaustive — satisfies the strict-check narrowing.
			const _never: never = rule.frequency;
			return _never;
		}
	}
}

function formatWeekly(rule: RecurrenceDescriptor, interval: number): string {
	const sortedDays = normaliseWeekdays(rule.weekdays);
	const daysText = sortedDays.length > 0 ? humanList(sortedDays.map((d) => weekdayLabel(d))) : null;
	if (interval === 1) {
		// "Every Monday" / "Every Monday and Wednesday" — or fallback if no weekdays.
		return daysText ? `Every ${daysText}` : 'Every week';
	}
	// "Every 2 weeks" or "Every 2 weeks on Mon and Wed"
	return daysText ? `Every ${interval} weeks on ${daysText}` : `Every ${interval} weeks`;
}

function formatMonthly(rule: RecurrenceDescriptor, interval: number, _locale: string): string {
	const type = rule.monthly_type ?? 'day';
	if (type === 'day') {
		const dom = rule.day_of_month;
		if (!dom || dom < 1 || dom > 31) {
			return interval === 1 ? 'Every month' : `Every ${interval} months`;
		}
		if (interval === 1) return `The ${ordinalSuffixEn(dom)} of every month`;
		return `Every ${interval} months on the ${ordinalSuffixEn(dom)}`;
	}
	// weekday mode
	const nth = rule.nth_weekday;
	const wd = rule.weekday;
	if (nth == null || wd == null || wd < 0 || wd > 6 || !isValidOrdinal(nth)) {
		return interval === 1 ? 'Every month' : `Every ${interval} months`;
	}
	const nthLabel = ordinalLabel(nth);
	const wdLabel = weekdayLabel(wd);
	if (interval === 1) return `The ${nthLabel} ${wdLabel} of every month`;
	return `Every ${interval} months on the ${nthLabel} ${wdLabel}`;
}

function formatBoundary(rule: RecurrenceDescriptor, locale: string): string {
	if (rule.count != null && rule.count > 0) {
		return rule.count === 1 ? 'for 1 occurrence' : `for ${rule.count} occurrences`;
	}
	if (rule.until) {
		const d = new Date(rule.until);
		if (!Number.isNaN(d.getTime())) {
			return `until ${new Intl.DateTimeFormat(locale, {
				day: 'numeric',
				month: 'long',
				year: 'numeric'
			}).format(d)}`;
		}
	}
	return '';
}

// --- helpers ---------------------------------------------------------------

function isValidOrdinal(n: number): n is WeekdayOrdinal {
	return n === -1 || n === 1 || n === 2 || n === 3 || n === 4;
}

function normaliseWeekdays(weekdays: readonly number[] | null | undefined): Weekday[] {
	if (!weekdays || weekdays.length === 0) return [];
	const seen = new Set<Weekday>();
	for (const w of weekdays) {
		if (Number.isInteger(w) && w >= 0 && w <= 6) seen.add(w as Weekday);
	}
	return [...seen].sort((a, b) => a - b);
}

function humanList(parts: string[]): string {
	if (parts.length === 0) return '';
	if (parts.length === 1) return parts[0];
	if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
	return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

// --- parseExdates ----------------------------------------------------------

// `exdates` arrives as ISO 8601 UTC strings. Invalid entries are silently
// filtered; callers should not trust the generated type alone because the
// backend's contract only guarantees the array shape.
export function parseExdates(exdates: readonly string[] | null | undefined): Date[] {
	if (!exdates || exdates.length === 0) return [];
	const out: Date[] = [];
	for (const s of exdates) {
		if (typeof s !== 'string') continue;
		const d = new Date(s);
		if (!Number.isNaN(d.getTime())) out.push(d);
	}
	// Chronological order — exdates are semantically a set of instants.
	return out.sort((a, b) => a.getTime() - b.getTime());
}

// --- mutual-exclusion guard ------------------------------------------------

export interface BoundaryGuardInput {
	kind?: BoundaryKind;
	until?: string | null;
	count?: number | null;
}

export interface BoundaryGuardResult {
	ok: boolean;
	reason?: 'both_set' | 'count_invalid' | 'until_invalid';
}

// Mirrors the backend constraint that `until` and `count` are mutually
// exclusive. UI should block submit until this returns `{ ok: true }`.
export function mutualExclusionGuard(input: BoundaryGuardInput): BoundaryGuardResult {
	const hasUntil = typeof input.until === 'string' && input.until.length > 0;
	const hasCount = typeof input.count === 'number' && input.count > 0;
	if (hasUntil && hasCount) return { ok: false, reason: 'both_set' };
	if (input.count != null && (!Number.isFinite(input.count) || input.count < 1)) {
		return { ok: false, reason: 'count_invalid' };
	}
	if (hasUntil && Number.isNaN(new Date(input.until as string).getTime())) {
		return { ok: false, reason: 'until_invalid' };
	}
	return { ok: true };
}

// --- boundary kind inference ----------------------------------------------

export function inferBoundaryKind(rule: RecurrenceDescriptor): BoundaryKind {
	if (rule.count != null && rule.count > 0) return 'count';
	if (rule.until) return 'until';
	return 'none';
}
