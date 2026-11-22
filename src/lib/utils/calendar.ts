/**
 * Calendar utility functions for date calculations
 * Week system: Monday-Sunday (ISO 8601 standard)
 */

import { getDateLocale } from './date';

export type CalendarView = 'month' | 'week' | 'year';

/**
 * Get the ISO week number (1-53) for a given date
 * Weeks run Monday-Sunday
 */
export function getISOWeek(date: Date): number {
	const d = new Date(date);
	d.setHours(0, 0, 0, 0);
	// Set to nearest Thursday: current date + 4 - current day number
	// Make Sunday's day number 7
	d.setDate(d.getDate() + 4 - (d.getDay() || 7));
	// Get first day of year
	const yearStart = new Date(d.getFullYear(), 0, 1);
	// Calculate full weeks to nearest Thursday
	const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
	return weekNo;
}

/**
 * Get the year for the ISO week
 * (ISO week may belong to previous or next year)
 */
export function getISOWeekYear(date: Date): number {
	const d = new Date(date);
	d.setDate(d.getDate() + 4 - (d.getDay() || 7));
	return d.getFullYear();
}

/**
 * Get the start date (Monday) of a given ISO week
 */
export function getWeekStartDate(year: number, week: number): Date {
	// January 4th is always in week 1
	const jan4 = new Date(year, 0, 4);
	// Get the Monday of week 1
	const week1Monday = new Date(jan4);
	week1Monday.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
	// Add weeks
	const result = new Date(week1Monday);
	result.setDate(week1Monday.getDate() + (week - 1) * 7);
	return result;
}

/**
 * Get the end date (Sunday) of a given ISO week
 */
export function getWeekEndDate(year: number, week: number): Date {
	const start = getWeekStartDate(year, week);
	const end = new Date(start);
	end.setDate(start.getDate() + 6);
	return end;
}

/**
 * Get the first day of a month
 */
export function getMonthStartDate(year: number, month: number): Date {
	return new Date(year, month - 1, 1);
}

/**
 * Get the last day of a month
 */
export function getMonthEndDate(year: number, month: number): Date {
	return new Date(year, month, 0);
}

/**
 * Get the number of days in a month
 */
export function getDaysInMonth(year: number, month: number): number {
	return new Date(year, month, 0).getDate();
}

/**
 * Get calendar grid for a month view
 * Returns array of weeks, each containing 7 days (Mon-Sun)
 * Includes days from previous/next months to fill the grid
 */
export function getMonthCalendarGrid(year: number, month: number): Date[][] {
	const firstDay = getMonthStartDate(year, month);
	const lastDay = getMonthEndDate(year, month);

	// Get the Monday before or on the first day of the month
	const startDate = new Date(firstDay);
	const dayOfWeek = (firstDay.getDay() + 6) % 7; // Convert to Mon=0, Sun=6
	startDate.setDate(firstDay.getDate() - dayOfWeek);

	// Get the Sunday after or on the last day of the month
	const endDate = new Date(lastDay);
	const lastDayOfWeek = (lastDay.getDay() + 6) % 7;
	endDate.setDate(lastDay.getDate() + (6 - lastDayOfWeek));

	const weeks: Date[][] = [];
	const currentDate = new Date(startDate);

	while (currentDate <= endDate) {
		const week: Date[] = [];
		for (let i = 0; i < 7; i++) {
			week.push(new Date(currentDate));
			currentDate.setDate(currentDate.getDate() + 1);
		}
		weeks.push(week);
	}

	return weeks;
}

/**
 * Get all days in a week (Mon-Sun)
 */
export function getWeekDays(year: number, week: number): Date[] {
	const days: Date[] = [];
	const monday = getWeekStartDate(year, week);

	for (let i = 0; i < 7; i++) {
		const day = new Date(monday);
		day.setDate(monday.getDate() + i);
		days.push(day);
	}

	return days;
}

/**
 * Get all months in a year (1-12)
 */
export function getYearMonths(_year: number): number[] {
	return Array.from({ length: 12 }, (_, i) => i + 1);
}

/**
 * Navigate to next period
 */
export function getNextPeriod(
	view: CalendarView,
	year: number,
	month: number,
	week: number
): { year: number; month: number; week: number } {
	if (view === 'month') {
		if (month === 12) {
			return { year: year + 1, month: 1, week: getISOWeek(new Date(year + 1, 0, 1)) };
		}
		return { year, month: month + 1, week: getISOWeek(new Date(year, month, 1)) };
	}

	if (view === 'week') {
		const currentWeekStart = getWeekStartDate(year, week);
		const nextWeekStart = new Date(currentWeekStart);
		nextWeekStart.setDate(currentWeekStart.getDate() + 7);
		return {
			year: getISOWeekYear(nextWeekStart),
			month: nextWeekStart.getMonth() + 1,
			week: getISOWeek(nextWeekStart)
		};
	}

	// year view
	return { year: year + 1, month, week };
}

/**
 * Navigate to previous period
 */
export function getPreviousPeriod(
	view: CalendarView,
	year: number,
	month: number,
	week: number
): { year: number; month: number; week: number } {
	if (view === 'month') {
		if (month === 1) {
			return { year: year - 1, month: 12, week: getISOWeek(new Date(year - 1, 11, 1)) };
		}
		return { year, month: month - 1, week: getISOWeek(new Date(year, month - 2, 1)) };
	}

	if (view === 'week') {
		const currentWeekStart = getWeekStartDate(year, week);
		const prevWeekStart = new Date(currentWeekStart);
		prevWeekStart.setDate(currentWeekStart.getDate() - 7);
		return {
			year: getISOWeekYear(prevWeekStart),
			month: prevWeekStart.getMonth() + 1,
			week: getISOWeek(prevWeekStart)
		};
	}

	// year view
	return { year: year - 1, month, week };
}

/**
 * Get current period (today)
 */
export function getCurrentPeriod(): { year: number; month: number; week: number } {
	const today = new Date();
	return {
		year: getISOWeekYear(today),
		month: today.getMonth() + 1,
		week: getISOWeek(today)
	};
}

/**
 * Check if a date is today
 */
export function isToday(date: Date): boolean {
	const today = new Date();
	return (
		date.getDate() === today.getDate() &&
		date.getMonth() === today.getMonth() &&
		date.getFullYear() === today.getFullYear()
	);
}

/**
 * Check if a date is in the current month/year
 */
export function isInMonth(date: Date, year: number, month: number): boolean {
	return date.getFullYear() === year && date.getMonth() === month - 1;
}

/** Short weekday name in the active locale, e.g. "Mon". */
export function formatWeekdayShort(date: Date): string {
	return date.toLocaleDateString(getDateLocale(), { weekday: 'short' });
}

/**
 * Format date for display
 */
export function formatCalendarDate(date: Date, format: 'short' | 'long' = 'short'): string {
	const locale = getDateLocale();
	if (format === 'short') {
		return date.toLocaleDateString(locale, { day: 'numeric' });
	}
	return date.toLocaleDateString(locale, {
		weekday: 'short',
		month: 'short',
		day: 'numeric'
	});
}

/**
 * Format month/year for display
 */
export function formatMonthYear(year: number, month: number): string {
	const date = new Date(year, month - 1, 1);
	return date.toLocaleDateString(getDateLocale(), { month: 'long', year: 'numeric' });
}

/** Long month name (1-12) in the UI language, independent of the machine's timezone. */
export function formatMonthName(month: number): string {
	const date = new Date(Date.UTC(2000, month - 1, 1));
	return date.toLocaleDateString(getDateLocale(), { month: 'long', timeZone: 'UTC' });
}

/**
 * Format week range for display
 */
export function formatWeekRange(year: number, week: number): string {
	const start = getWeekStartDate(year, week);
	const end = getWeekEndDate(year, week);
	const locale = getDateLocale();

	const startStr = start.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
	const endStr = end.toLocaleDateString(locale, {
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	});

	return `${startStr} - ${endStr}`;
}

const dayKeyFormatters = new Map<string, Intl.DateTimeFormat>();

/**
 * Calendar day ("YYYY-MM-DD") of an instant in the given IANA zone, or in the
 * viewer's zone when none is given (or the zone is invalid).
 */
export function getDayKeyInZone(dateString: string, timeZone?: string | null): string {
	const key = timeZone || '';
	let fmt = dayKeyFormatters.get(key);
	if (!fmt) {
		const opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit' };
		try {
			fmt = new Intl.DateTimeFormat('en-CA', timeZone ? { ...opts, timeZone } : opts);
		} catch {
			fmt = new Intl.DateTimeFormat('en-CA', opts);
		}
		dayKeyFormatters.set(key, fmt);
	}
	return fmt.format(new Date(dateString));
}

function localDayKey(date: Date): string {
	const pad = (n: number): string => String(n).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Get events for a specific calendar day (a local-midnight Date column).
 * Each event is placed on its day in the EVENT's timezone (falling back to the
 * viewer's), so it lands in the column matching the time shown on it.
 */
export function getEventsForDay<T extends { start: string; timezone?: string | null }>(
	events: T[],
	date: Date
): T[] {
	const target = localDayKey(date);
	return events.filter((event) => getDayKeyInZone(event.start, event.timezone) === target);
}

/**
 * Parse calendar params from URL search params
 */
export function parseCalendarParams(searchParams: URLSearchParams): {
	view: CalendarView;
	year: number;
	month: number;
	week: number;
} {
	const current = getCurrentPeriod();

	const view = (searchParams.get('view') as CalendarView) || 'month';
	const year = parseInt(searchParams.get('year') || String(current.year));
	const month = parseInt(searchParams.get('month') || String(current.month));
	const week = parseInt(searchParams.get('week') || String(current.week));

	return { view, year, month, week };
}

/**
 * Build calendar params for URL
 */
export function buildCalendarParams(
	view: CalendarView,
	year: number,
	month: number,
	week: number
): URLSearchParams {
	const params = new URLSearchParams();
	params.set('view', view);
	params.set('year', String(year));
	params.set('month', String(month));
	params.set('week', String(week));
	return params;
}

/**
 * Parts for a big "date slab" (weekday, day number, textual month) in the active
 * UI locale, rendered in the event's own timezone when given.
 */
export function getDateSlabParts(
	dateString: string,
	timeZone?: string
): { weekday: string; day: string; month: string } {
	const date = new Date(dateString);
	const locale = getDateLocale();
	const part = (options: Intl.DateTimeFormatOptions): string =>
		new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(date);
	return {
		weekday: part({ weekday: 'short' }),
		day: part({ day: 'numeric' }),
		month: part({ month: 'long' })
	};
}

/** Compact agenda date with a textual month, e.g. "Fri, Oct 31". */
export function formatAgendaDate(dateString: string, timeZone?: string): string {
	return new Intl.DateTimeFormat(getDateLocale(), {
		weekday: 'short',
		day: 'numeric',
		month: 'short',
		timeZone
	}).format(new Date(dateString));
}
