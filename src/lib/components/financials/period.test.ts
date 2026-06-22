import { describe, it, expect } from 'vitest';
import { periodToDateRange, type PeriodValue } from './period';

describe('periodToDateRange', () => {
	it('maps a full year to Jan 1 – Dec 31', () => {
		const value: PeriodValue = { year: 2026, month: null, quarter: null };
		expect(periodToDateRange(value)).toEqual({
			date_from: '2026-01-01',
			date_to: '2026-12-31'
		});
	});

	it('maps each quarter to its month boundaries', () => {
		expect(periodToDateRange({ year: 2026, month: null, quarter: 1 })).toEqual({
			date_from: '2026-01-01',
			date_to: '2026-03-31'
		});
		expect(periodToDateRange({ year: 2026, month: null, quarter: 2 })).toEqual({
			date_from: '2026-04-01',
			date_to: '2026-06-30'
		});
		expect(periodToDateRange({ year: 2026, month: null, quarter: 3 })).toEqual({
			date_from: '2026-07-01',
			date_to: '2026-09-30'
		});
		expect(periodToDateRange({ year: 2026, month: null, quarter: 4 })).toEqual({
			date_from: '2026-10-01',
			date_to: '2026-12-31'
		});
	});

	it('maps a month to its first and last day, zero-padded', () => {
		expect(periodToDateRange({ year: 2026, month: 3, quarter: null })).toEqual({
			date_from: '2026-03-01',
			date_to: '2026-03-31'
		});
	});

	it('handles February in a non-leap year (28 days)', () => {
		expect(periodToDateRange({ year: 2026, month: 2, quarter: null })).toEqual({
			date_from: '2026-02-01',
			date_to: '2026-02-28'
		});
	});

	it('handles February in a leap year (29 days)', () => {
		expect(periodToDateRange({ year: 2028, month: 2, quarter: null })).toEqual({
			date_from: '2028-02-01',
			date_to: '2028-02-29'
		});
	});

	it('prefers quarter over month when both are somehow set', () => {
		// Defensive: the UI keeps these mutually exclusive, but quarter wins here.
		expect(periodToDateRange({ year: 2026, month: 8, quarter: 1 })).toEqual({
			date_from: '2026-01-01',
			date_to: '2026-03-31'
		});
	});
});
