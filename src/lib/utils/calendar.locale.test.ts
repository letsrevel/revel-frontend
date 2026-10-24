import { describe, expect, it, vi } from 'vitest';

const { getLocale } = vi.hoisted(() => ({ getLocale: vi.fn(() => 'en') }));
vi.mock('$lib/paraglide/runtime.js', () => ({ getLocale }));

import {
	formatMonthYear,
	formatWeekRange,
	formatCalendarDate,
	formatWeekdayShort,
	getDateSlabParts,
	formatAgendaDate
} from './calendar';

describe('calendar formatting follows the app UI locale (#508)', () => {
	it('formatMonthYear renders the month name in the active locale', () => {
		getLocale.mockReturnValue('fr');
		expect(formatMonthYear(2026, 1)).toContain('janvier');
		getLocale.mockReturnValue('de');
		expect(formatMonthYear(2026, 1)).toContain('Januar');
	});

	it('formatWeekRange uses a textual month (never a bare number)', () => {
		getLocale.mockReturnValue('fr');
		const out = formatWeekRange(2026, 10);
		expect(out).toMatch(/[A-Za-zÀ-ÿ]{3,}/); // contains an alphabetic month, not "3/2"
	});

	it('formatCalendarDate long form renders a textual weekday + month', () => {
		getLocale.mockReturnValue('it');
		expect(formatCalendarDate(new Date(2026, 0, 15), 'long')).toMatch(/[A-Za-zÀ-ÿ]{3,}/);
	});
});

describe('formatWeekdayShort (#510)', () => {
	// 2026-01-05 is a Monday
	const monday = new Date(2026, 0, 5);

	it('returns an alphabetic abbreviation of at least 2 characters', () => {
		getLocale.mockReturnValue('en');
		const out = formatWeekdayShort(monday);
		expect(out).toMatch(/[A-Za-zÀ-ÿ]{2,}/);
	});

	it('changes output when the locale changes (en vs fr)', () => {
		getLocale.mockReturnValue('en');
		const en = formatWeekdayShort(monday);
		getLocale.mockReturnValue('fr');
		const fr = formatWeekdayShort(monday);
		expect(en).not.toBe(fr);
	});

	it('en locale produces "Mon" for a Monday', () => {
		getLocale.mockReturnValue('en');
		expect(formatWeekdayShort(monday)).toBe('Mon');
	});

	it('fr locale produces a French abbreviation for Monday', () => {
		getLocale.mockReturnValue('fr');
		// French Monday short form is "lun." in most ICU versions
		expect(formatWeekdayShort(monday)).toMatch(/lun/i);
	});
});

describe('dashboard date helpers', () => {
	it('getDateSlabParts splits a date in the event timezone', () => {
		getLocale.mockReturnValue('en');
		// 23:30 UTC on Oct 31 is already Nov 1 in Rome.
		const parts = getDateSlabParts('2026-10-31T23:30:00Z', 'Europe/Rome');
		expect(parts).toEqual({ weekday: 'Sun', day: '1', month: 'November' });
	});

	it('getDateSlabParts localizes the month name', () => {
		getLocale.mockReturnValue('de');
		expect(getDateSlabParts('2026-01-15T12:00:00Z', 'UTC').month).toBe('Januar');
	});

	it('formatAgendaDate uses a textual month', () => {
		getLocale.mockReturnValue('en');
		expect(formatAgendaDate('2026-10-30T12:00:00Z', 'UTC')).toBe('Fri, Oct 30');
		getLocale.mockReturnValue('fr');
		expect(formatAgendaDate('2026-01-15T12:00:00Z', 'UTC')).toMatch(/janv/);
	});
});
