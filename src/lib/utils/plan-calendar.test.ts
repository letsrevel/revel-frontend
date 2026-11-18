import { describe, expect, it, vi } from 'vitest';

const { getLocale } = vi.hoisted(() => ({ getLocale: vi.fn(() => 'en') }));
vi.mock('$lib/paraglide/runtime.js', () => ({ getLocale }));

import {
	calendarAlignmentLabel,
	firstPeriodQuote,
	formatPeriodLastDay,
	isCalendarPlan,
	samePeriodGrid
} from './plan-calendar';
import { formatMonthName } from './calendar';

describe('isCalendarPlan', () => {
	it('is true only for calendar plans; missing means rolling', () => {
		expect(isCalendarPlan({ period_alignment: 'calendar' })).toBe(true);
		expect(isCalendarPlan({ period_alignment: 'rolling' })).toBe(false);
		expect(isCalendarPlan({})).toBe(false);
	});
});

describe('samePeriodGrid', () => {
	const roll = { period_alignment: 'rolling', period_unit: 'month' } as const;
	const calM = { period_alignment: 'calendar', period_unit: 'month' } as const;
	const calY1 = {
		period_alignment: 'calendar',
		period_unit: 'year',
		calendar_start_month: 1
	} as const;
	const calY7 = { ...calY1, calendar_start_month: 7 } as const;

	it('rolling to rolling is allowed regardless of unit', () => {
		expect(samePeriodGrid(roll, { period_alignment: 'rolling', period_unit: 'year' })).toBe(true);
		expect(samePeriodGrid({}, roll)).toBe(true);
	});
	it('mixed calendar-ness is not allowed in either direction', () => {
		expect(samePeriodGrid(roll, calM)).toBe(false);
		expect(samePeriodGrid(calM, roll)).toBe(false);
	});
	it('calendar plans need the same unit and start month', () => {
		expect(samePeriodGrid(calM, calM)).toBe(true);
		expect(samePeriodGrid(calY1, calY1)).toBe(true);
		expect(samePeriodGrid(calY1, calY7)).toBe(false);
		expect(samePeriodGrid(calM, calY1)).toBe(false);
	});
});

describe('formatMonthName', () => {
	it('names the month in the active locale', () => {
		getLocale.mockReturnValue('en');
		expect(formatMonthName(1)).toBe('January');
		expect(formatMonthName(12)).toBe('December');
		getLocale.mockReturnValue('de');
		expect(formatMonthName(3)).toBe('März');
		getLocale.mockReturnValue('en');
	});
});

describe('formatPeriodLastDay', () => {
	it('renders the inclusive last day in UTC for an exclusive end', () => {
		expect(formatPeriodLastDay('2027-01-01T00:00:00Z')).toBe('December 31, 2026');
		expect(formatPeriodLastDay('2026-03-01T00:00:00Z')).toBe('February 28, 2026');
	});
});

describe('calendarAlignmentLabel', () => {
	it('is null for rolling plans', () => {
		expect(
			calendarAlignmentLabel({ period_alignment: 'rolling', period_unit: 'month' })
		).toBeNull();
	});
	it('describes calendar months', () => {
		expect(calendarAlignmentLabel({ period_alignment: 'calendar', period_unit: 'month' })).toBe(
			'Calendar month (renews on the 1st)'
		);
	});
	it('describes calendar years with their start month, defaulting to January', () => {
		expect(
			calendarAlignmentLabel({
				period_alignment: 'calendar',
				period_unit: 'year',
				calendar_start_month: 7
			})
		).toBe('Calendar year from July');
		expect(calendarAlignmentLabel({ period_alignment: 'calendar', period_unit: 'year' })).toBe(
			'Calendar year from January'
		);
	});
});

describe('firstPeriodQuote', () => {
	const base = {
		period_alignment: 'calendar',
		first_period_pricing: 'prorated',
		first_period_end: '2027-01-01T00:00:00Z',
		first_period_price: '3.50'
	} as const;

	it('is null for rolling plans or without an end', () => {
		expect(firstPeriodQuote({ ...base, period_alignment: 'rolling' })).toBeNull();
		expect(firstPeriodQuote({ ...base, first_period_end: null })).toBeNull();
	});
	it('returns the quote with the inclusive last day', () => {
		expect(firstPeriodQuote(base)).toEqual({
			lastDay: 'December 31, 2026',
			price: '3.50',
			isFree: false,
			pricing: 'prorated'
		});
	});
	it('flags a free first period', () => {
		expect(firstPeriodQuote({ ...base, first_period_price: '0.00' })?.isFree).toBe(true);
	});
});
