import { describe, expect, it, vi } from 'vitest';

// Force a stable locale so 12-hour formatting (gated on en-US) is deterministic
// regardless of the machine running the tests.
vi.mock('$lib/paraglide/runtime.js', () => ({
	getLocale: () => 'en'
}));

import {
	formatEventDate,
	formatEventDateRange,
	formatEventDateForScreenReader,
	formatDateTime,
	formatDateTimeReadback,
	formatDate,
	formatEventTimezoneLabel
} from './date';

// A fixed winter instant (no DST ambiguity):
//   19:00 UTC  →  14:00 (2:00 PM) EST in New York,  20:00 (8:00 PM) CET in Vienna.
const WINTER_UTC = '2026-02-06T19:00:00Z';

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

describe('formatEventDateRange same-day detection is timezone-aware', () => {
	// 22:00 UTC → 17:00 EST (Feb 6) and 23:00 CET (Feb 6)
	// 03:00 UTC next day → 22:00 EST (still Feb 6) and 04:00 CET (Feb 7)
	const start = '2026-02-06T22:00:00Z';
	const end = '2026-02-07T03:00:00Z';

	it('collapses to a single date when both ends fall on the same local day', () => {
		const ny = formatEventDateRange(start, end, 'America/New_York');
		expect(ny).toContain('5:00 PM - 10:00 PM');
	});

	it('shows two dates when the local days differ', () => {
		const vienna = formatEventDateRange(start, end, 'Europe/Vienna');
		// A cross-day range repeats the bullet separator for the end date.
		expect(vienna.match(/•/g)?.length).toBe(2);
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

describe('formatDateTime and screen-reader format carry the timezone', () => {
	it('formatDateTime includes the localized time and abbreviation', () => {
		const out = formatDateTime(WINTER_UTC, 'America/New_York');
		expect(out).toContain('2:00 PM');
		expect(out).toContain('EST');
	});

	it('screen-reader format spells out the date in the event timezone', () => {
		const out = formatEventDateForScreenReader(WINTER_UTC, 'America/New_York');
		expect(out).toContain('February');
		expect(out).toContain('2:00 PM');
		expect(out).toContain('EST');
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
