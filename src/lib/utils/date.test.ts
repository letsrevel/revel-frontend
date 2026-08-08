import { afterEach, describe, expect, it, vi } from 'vitest';

// Force a stable locale so hour-cycle and month names are deterministic
// regardless of the machine running the tests. The mock is mutable so the
// getDateLocale fallback (unknown UI language → en-US) can be exercised.
//
// NOTE: for full determinism, also pin TZ=UTC for the test run (vitest.config
// `test.env: { TZ: 'UTC' }` or `TZ=UTC vitest` in the npm script) — the
// no-timezone code paths render in the machine's local zone. The assertions
// below are written to hold either way, but pinning removes the ambiguity.
const mockLocale = vi.hoisted(() => ({ value: 'en' }));
vi.mock('$lib/paraglide/runtime.js', () => ({
	getLocale: () => mockLocale.value
}));

import {
	getDateLocale,
	formatEventDate,
	formatEventDateRange,
	formatEventDateForScreenReader,
	formatDateTime,
	formatDateTimeReadback,
	formatDate,
	formatEventTimezoneLabel,
	formatViewerTimezoneLabel,
	formatDateLongMonth,
	formatDateTimeVerbose,
	formatMonthYearLabel,
	formatRelativeTime,
	formatTimeOfDay,
	getRSVPDeadlineRelative,
	isEventPast,
	isRSVPClosed,
	isRSVPClosingSoon
} from './date';

afterEach(() => {
	mockLocale.value = 'en';
	vi.useRealTimers();
});

// A fixed winter instant (no DST ambiguity):
//   19:00 UTC  →  14:00 (2:00 PM) EST in New York,  20:00 (8:00 PM) CET in Vienna.
const WINTER_UTC = '2026-02-06T19:00:00Z';

// Fixed "now" for every wall-clock-dependent test. Freezing time makes the
// relative-time assertions exact instead of racing the real clock (a deadline
// built as `now + 2h` and floored inside the function lands on "in 1 hour"
// whenever any real time elapses in between).
const FROZEN_NOW = '2026-06-15T10:00:00.000Z';

function freezeTime(iso: string = FROZEN_NOW) {
	vi.useFakeTimers();
	vi.setSystemTime(new Date(iso));
}

describe('formatEventDate with an explicit timezone (#474)', () => {
	it('renders the instant in the given timezone, not the viewer’s', () => {
		const ny = formatEventDate(WINTER_UTC, 'America/New_York');
		const vienna = formatEventDate(WINTER_UTC, 'Europe/Vienna');

		expect(ny).toContain('2:00 PM');
		expect(vienna).toContain('8:00 PM');
		expect(ny).not.toBe(vienna);
	});

	it('appends a timezone abbreviation when a timezone is supplied', () => {
		// New York's short name is reliably "EST" in winter across ICU versions.
		// (Vienna renders as "GMT+1"/"GMT+2" in en-US on current full-ICU Node —
		// the most ICU-version-sensitive assumption in this file.)
		expect(formatEventDate(WINTER_UTC, 'America/New_York')).toContain('EST');
	});

	it('omits the timezone abbreviation when no timezone is supplied (backward compatible)', () => {
		expect(formatEventDate(WINTER_UTC)).not.toContain('EST');
	});

	it('omits the abbreviation when withAbbreviation is false (paired with a tz label)', () => {
		const out = formatEventDate(WINTER_UTC, 'America/New_York', false);
		expect(out).toContain('2:00 PM');
		expect(out).not.toContain('EST');
	});
});

describe('formatEventTimezoneLabel', () => {
	it('combines the place name with the DST-aware offset', () => {
		expect(formatEventTimezoneLabel(WINTER_UTC, 'America/New_York', 'New York')).toBe(
			'New York (EST)'
		);
	});

	it('falls back to the IANA zone tail when no place is given', () => {
		expect(formatEventTimezoneLabel(WINTER_UTC, 'America/New_York')).toBe('New York (EST)');
	});
});

describe('formatViewerTimezoneLabel (#818)', () => {
	// The viewer's zone is whatever the machine reports, so the expectation is
	// derived from the same source rather than hardcoded — what's under test is
	// the wiring (viewer zone → humanized name), not ICU.
	function viewerZone(): string {
		return Intl.DateTimeFormat().resolvedOptions().timeZone;
	}

	it('names the viewer’s own timezone, humanized from the IANA zone', () => {
		const expected = viewerZone().split('/').pop()?.replace(/_/g, ' ');
		expect(formatViewerTimezoneLabel()).toBe(expected);
	});

	it('replaces underscores in multi-word zone tails', () => {
		// Guards the humanization itself regardless of the machine's own zone:
		// "America/New_York" must never surface as "New_York".
		expect(formatViewerTimezoneLabel()).not.toContain('_');
	});

	// The reason this label is a NAME and not an offset: it heads a list whose
	// rows each render with the offset in effect at their own instant, so an
	// offset here would contradict rows on the far side of a DST transition.
	it('is DST-invariant — identical either side of a transition', () => {
		freezeTime('2026-01-15T12:00:00Z');
		const winter = formatViewerTimezoneLabel();
		vi.setSystemTime(new Date('2026-07-15T12:00:00Z'));
		const summer = formatViewerTimezoneLabel();

		expect(summer).toBe(winter);
	});

	it('appends no parenthesized offset — unlike the event-zone label', () => {
		// formatEventTimezoneLabel renders "New York (EST)"; this one stops at
		// the name. (Not asserted via /GMT[+-]/: an `Etc/GMT±N` viewer zone is
		// legitimately *named* "GMT+N".)
		expect(formatViewerTimezoneLabel()).not.toContain('(');
	});
});

describe('formatEventDateRange same-day detection is timezone-aware', () => {
	// 22:00 UTC → 17:00 EST (Feb 6) and 23:00 CET (Feb 6)
	// 03:00 UTC next day → 22:00 EST (still Feb 6) and 04:00 CET (Feb 7)
	const start = '2026-02-06T22:00:00Z';
	const end = '2026-02-07T03:00:00Z';

	it('collapses to a single date when both ends fall on the same local day', () => {
		const ny = formatEventDateRange(start, end, 'America/New_York');
		// formatRange output: locale range dash, shared day-period collapsed.
		// (\s also matches the narrow no-break space ICU puts before "PM".)
		expect(ny).toMatch(/5:00\s*–\s*10:00\sPM/);
		expect(ny.match(/•/g)?.length).toBe(1);
	});

	it('shows two dates when the local days differ', () => {
		const vienna = formatEventDateRange(start, end, 'Europe/Vienna');
		// A cross-day range repeats the bullet separator for the end date.
		expect(vienna.match(/•/g)?.length).toBe(2);
	});

	it('uses the en dash separator in the hand-built cross-day branch (consistent with formatRange)', () => {
		const vienna = formatEventDateRange(start, end, 'Europe/Vienna');
		expect(vienna).toContain(' – ');
		expect(vienna).not.toContain(' - ');
	});

	it('labels each end with its own offset across a DST transition', () => {
		// Europe/Vienna springs forward on 2026-03-29: 23:00 Mar 28 is GMT+1,
		// 13:00 Mar 29 is GMT+2. The end must not inherit the start's offset.
		const out = formatEventDateRange(
			'2026-03-28T22:00:00Z',
			'2026-03-29T11:00:00Z',
			'Europe/Vienna'
		);
		expect(out).toContain('11:00 PM GMT+1');
		expect(out).toContain('1:00 PM GMT+2');
	});

	it('labels each end with its own offset when a DST transition falls within a single local day', () => {
		// Europe/Vienna falls back on 2026-10-25: 03:00 GMT+2 → 02:00 GMT+1.
		// 23:00 UTC Oct 24 → 01:00 Oct 25 (GMT+2); 11:00 UTC Oct 25 → 12:00 Oct 25 (GMT+1).
		// Same local calendar day, but the offsets differ — the range must not
		// label the end time with the start's offset.
		const out = formatEventDateRange(
			'2026-10-24T23:00:00Z',
			'2026-10-25T11:00:00Z',
			'Europe/Vienna'
		);
		expect(out).toContain('1:00 AM GMT+2');
		expect(out).toContain('12:00 PM GMT+1');
		// Date still shown only once (same-day collapse preserved).
		expect(out.match(/•/g)?.length).toBe(1);
	});
});

describe('formatDate applies the timezone to the calendar day without an abbreviation', () => {
	// 23:00 UTC → 18:00 Feb 6 in New York, but 00:00 Feb 7 in Vienna.
	const iso = '2026-02-06T23:00:00Z';

	it('rolls the date forward/back according to the timezone', () => {
		expect(formatDate(iso, 'America/New_York')).toContain('Feb 6');
		expect(formatDate(iso, 'Europe/Vienna')).toContain('Feb 7');
	});

	it('does not append a timezone abbreviation to a date-only value', () => {
		expect(formatDate(iso, 'America/New_York')).not.toMatch(/EST|GMT/);
	});
});

describe('getDateLocale falls back to en-US for an unmapped UI language', () => {
	it('renders English month names when the UI language is unknown', () => {
		mockLocale.value = 'xx';
		expect(formatDate(WINTER_UTC, 'America/New_York')).toContain('Feb');
	});
});

describe('formatDateTime and screen-reader format carry the timezone', () => {
	it('formatDateTime includes the localized time and abbreviation', () => {
		const out = formatDateTime(WINTER_UTC, 'America/New_York');
		expect(out).toContain('2:00 PM');
		expect(out).toContain('EST');
	});

	it('formatDateTime also accepts an already-parsed Date', () => {
		const out = formatDateTime(new Date(WINTER_UTC), 'America/New_York');
		expect(out).toContain('2:00 PM');
		expect(out).toContain('EST');
	});

	it('screen-reader format spells out the date in the event timezone', () => {
		const out = formatEventDateForScreenReader(WINTER_UTC, 'America/New_York');
		expect(out).toContain('February');
		expect(out).toContain('2:00 PM');
		expect(out).toContain('EST');
	});

	it('screen-reader format appends the spoken "Uhr" after the minutes in German', () => {
		mockLocale.value = 'de';
		const out = formatEventDateForScreenReader(WINTER_UTC, 'Europe/Vienna');
		// "Freitag, 6. Februar 2026 um 20:00 Uhr MEZ" — Uhr sits between the
		// time and the tz abbreviation, not at the end of the string.
		expect(out).toContain('Februar');
		expect(out).toContain('20:00 Uhr');
		expect(out).toMatch(/20:00 Uhr MEZ$/);
	});

	it('screen-reader format adds no time word for locales without one (en unchanged)', () => {
		const out = formatEventDateForScreenReader(WINTER_UTC, 'Europe/Vienna');
		expect(out).not.toContain('Uhr');
	});
});

describe('formatTimeOfDay', () => {
	it('renders only the clock time in the supplied timezone, no abbreviation', () => {
		const out = formatTimeOfDay(WINTER_UTC, 'America/New_York');
		expect(out).toContain('2:00 PM');
		expect(out).not.toContain('EST');
		expect(out).not.toContain('February');
	});
});

describe('formatDateTimeReadback (#508 picker readback)', () => {
	it('returns "" for empty/nullish input', () => {
		expect(formatDateTimeReadback('')).toBe('');
		expect(formatDateTimeReadback(null)).toBe('');
		expect(formatDateTimeReadback(undefined)).toBe('');
	});

	it('returns "" for an invalid datetime string', () => {
		expect(formatDateTimeReadback('not-a-date')).toBe('');
	});

	it('renders a textual month and year for a datetime-local value', () => {
		const out = formatDateTimeReadback('2026-06-07T12:00');
		expect(out).toContain('2026');
		expect(out).toContain('Jun'); // en-US short month — textual, never "6"
		expect(out).not.toMatch(/\b0?6\/0?7\b/); // not numeric m/d
	});

	it('also accepts a full ISO 8601 string', () => {
		expect(formatDateTimeReadback('2026-06-07T12:00:00Z')).toContain('2026');
	});
});

describe('formatDateLongMonth (#510)', () => {
	it('contains the full month name and year, no time', () => {
		const out = formatDateLongMonth('2026-06-07T12:00:00Z');
		expect(out).toContain('June');
		expect(out).toContain('2026');
	});

	it('contains the day of month', () => {
		const out = formatDateLongMonth('2026-06-07T12:00:00Z');
		expect(out).toContain('7');
	});

	it('does not contain a time component (no colon)', () => {
		const out = formatDateLongMonth('2026-06-07T12:00:00Z');
		expect(out).not.toMatch(/\d+:\d+/);
	});

	it('respects timezone when supplied (date may shift a day)', () => {
		// 2026-02-06T23:00:00Z is Feb 6 in New York and Feb 7 in Vienna
		const ny = formatDateLongMonth('2026-02-06T23:00:00Z', 'America/New_York');
		const vienna = formatDateLongMonth('2026-02-06T23:00:00Z', 'Europe/Vienna');
		expect(ny).toContain('February');
		expect(ny).toContain('6');
		expect(vienna).toContain('February');
		expect(vienna).toContain('7');
	});
});

describe('formatDateTimeVerbose (#510)', () => {
	it('contains the full month name, year, and a time component', () => {
		const out = formatDateTimeVerbose('2026-06-07T12:00:00Z');
		expect(out).toContain('June');
		expect(out).toContain('2026');
		expect(out).toMatch(/\d+:\d+/);
	});

	it('includes AM/PM for en-US locale', () => {
		const out = formatDateTimeVerbose('2026-06-07T12:00:00Z');
		expect(out).toMatch(/AM|PM/);
	});

	it('respects a supplied timezone', () => {
		// 2026-02-06T19:00:00Z → 2:00 PM EST in New York
		const out = formatDateTimeVerbose('2026-02-06T19:00:00Z', 'America/New_York');
		expect(out).toContain('2:00 PM');
		expect(out).toContain('February');
	});
});

describe('formatMonthYearLabel (#510)', () => {
	it('contains the full month name and year', () => {
		const out = formatMonthYearLabel('2026-06-07T12:00:00Z');
		expect(out).toContain('June');
		expect(out).toContain('2026');
	});

	it('does not contain a day number', () => {
		// The string should not contain " 7" or "7," etc. (isolated day digit)
		const out = formatMonthYearLabel('2026-06-07T12:00:00Z');
		expect(out).not.toMatch(/\b7\b/);
	});

	it('does not contain a time component', () => {
		const out = formatMonthYearLabel('2026-06-07T12:00:00Z');
		expect(out).not.toMatch(/\d+:\d+/);
	});
});

describe('getRSVPDeadlineRelative', () => {
	it('returns null for a passed deadline (caller supplies the "closed" copy)', () => {
		freezeTime();
		expect(getRSVPDeadlineRelative('2026-06-15T09:59:00.000Z')).toBeNull();
	});

	it('treats the exact deadline instant as closed', () => {
		freezeTime(FROZEN_NOW);
		expect(getRSVPDeadlineRelative(FROZEN_NOW)).toBeNull();
	});

	it('returns a localized relative phrase for a future deadline', () => {
		freezeTime(); // 10:00Z — deadline exactly 2h later
		expect(getRSVPDeadlineRelative('2026-06-15T12:00:00.000Z')).toBe('in 2 hours');
	});

	it('uses minutes below one hour', () => {
		freezeTime();
		expect(getRSVPDeadlineRelative('2026-06-15T10:30:00.000Z')).toBe('in 30 minutes');
	});

	it('uses days at 24 hours and beyond', () => {
		freezeTime();
		expect(getRSVPDeadlineRelative('2026-06-18T10:00:00.000Z')).toBe('in 3 days');
	});

	it('never says "in 0 minutes" for a deadline seconds away', () => {
		freezeTime();
		expect(getRSVPDeadlineRelative('2026-06-15T10:00:30.000Z')).toBe('in 1 minute');
	});
});

describe('formatRelativeTime', () => {
	it('phrases future instants with "in …"', () => {
		freezeTime();
		expect(formatRelativeTime('2026-06-18T10:00:00.000Z')).toBe('in 3 days');
		expect(formatRelativeTime('2026-06-15T12:00:00.000Z')).toBe('in 2 hours');
	});

	it('phrases past instants with "… ago" (or the locale idiom via numeric:auto)', () => {
		freezeTime();
		expect(formatRelativeTime('2026-06-15T08:00:00.000Z')).toBe('2 hours ago');
		// numeric: 'auto' — exactly one day back becomes the idiom, not "1 day ago".
		expect(formatRelativeTime('2026-06-14T10:00:00.000Z')).toBe('yesterday');
	});

	it('falls through to seconds below one minute', () => {
		freezeTime();
		expect(formatRelativeTime('2026-06-15T10:00:30.000Z')).toBe('in 30 seconds');
	});
});

describe('isEventPast', () => {
	it('is false while the event is still running', () => {
		freezeTime();
		expect(isEventPast('2026-06-15T11:00:00.000Z')).toBe(false);
	});

	it('is true once the end has passed', () => {
		freezeTime();
		expect(isEventPast('2026-06-15T09:00:00.000Z')).toBe(true);
	});
});

describe('isRSVPClosed', () => {
	it('is false for a nullish deadline (no deadline set)', () => {
		expect(isRSVPClosed(null)).toBe(false);
		expect(isRSVPClosed(undefined)).toBe(false);
		expect(isRSVPClosed('')).toBe(false);
	});

	it('is false before the deadline and true after it', () => {
		freezeTime();
		expect(isRSVPClosed('2026-06-15T12:00:00.000Z')).toBe(false);
		expect(isRSVPClosed('2026-06-15T09:00:00.000Z')).toBe(true);
	});

	it('treats the exact deadline instant as closed (consistent with getRSVPDeadlineRelative)', () => {
		freezeTime(FROZEN_NOW);
		expect(isRSVPClosed(FROZEN_NOW)).toBe(true);
		// The two must never disagree at the boundary.
		expect(getRSVPDeadlineRelative(FROZEN_NOW)).toBeNull();
	});
});

describe('isRSVPClosingSoon', () => {
	it('is false for a nullish deadline', () => {
		expect(isRSVPClosingSoon(null)).toBe(false);
	});

	it('is true within 24 hours, false beyond, false once passed', () => {
		freezeTime();
		expect(isRSVPClosingSoon('2026-06-15T12:00:00.000Z')).toBe(true); // in 2h
		expect(isRSVPClosingSoon('2026-06-17T10:00:00.000Z')).toBe(false); // in 48h
		expect(isRSVPClosingSoon('2026-06-15T09:00:00.000Z')).toBe(false); // passed
	});
});

describe('every supported UI language uses a textual month in the short forms', () => {
	// Mirrors the keys of LOCALE_MAP in date.ts. If a language is added there,
	// add it here so the invariant below covers it.
	const SUPPORTED_UI_LANGUAGES = ['en', 'de', 'it', 'fr', 'es', 'pt'];

	// The invariant guarded here: the `month: 'short'` skeletons used across
	// this file (MMMd in formatEventDate/formatEventDateRange, yMMMd in
	// formatDateTime/formatDate/formatDateTimeReadback) must resolve to a
	// *textual* month in every mapped locale. This is a property of the
	// locale's CLDR pattern data, not of the requested options: a locale may
	// have abbreviated month names yet map these skeletons to numeric
	// patterns — pt-PT does exactly that ("sexta, 24/10"), which is why
	// LOCALE_MAP maps pt to pt-BR ("sex., 24 de out.").
	it.each(SUPPORTED_UI_LANGUAGES)(
		'%s resolves the short-month-with-day skeletons to a month word',
		(lang) => {
			mockLocale.value = lang;
			const locale = getDateLocale();

			for (const options of [
				{ month: 'short', day: 'numeric' }, // MMMd (formatEventDate)
				{ year: 'numeric', month: 'short', day: 'numeric' } // yMMMd (formatDateTime, formatDate)
			] as Intl.DateTimeFormatOptions[]) {
				const month = new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' })
					.formatToParts(new Date(WINTER_UTC))
					.find((p) => p.type === 'month')?.value;

				expect(month, `${lang} → ${locale} ${JSON.stringify(options)}`).toMatch(/\p{L}/u);
			}
		}
	);

	it.each(SUPPORTED_UI_LANGUAGES)(
		'%s end-to-end: formatEventDate contains no numeric d/M',
		(lang) => {
			mockLocale.value = lang;
			// A numeric month pattern surfaces as slash-separated digits
			// (pt-PT would render "sexta, 24/10 • …").
			expect(formatEventDate(WINTER_UTC, 'Europe/Vienna')).not.toMatch(/\d+\/\d+/);
		}
	);

	it('pt renders the Brazilian textual short date, not the pt-PT numeric one', () => {
		mockLocale.value = 'pt';
		const out = formatEventDate(WINTER_UTC, 'Europe/Vienna');
		expect(out).toContain('fev.'); // "sex., 6 de fev. • 20:00 …"
		expect(out).not.toContain('06/02');
	});
});
