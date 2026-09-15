import { describe, it, expect } from 'vitest';
import { toStorage, fromStorage, toDisplay, ALLOWED_UNITS } from './duration';

describe('toStorage', () => {
	it('converts days to days as-is', () => {
		expect(toStorage(7, 'days', 'days')).toBe(7);
	});

	it('converts weeks to days', () => {
		expect(toStorage(2, 'weeks', 'days')).toBe(14);
	});

	it('converts months to days using 30-day month', () => {
		expect(toStorage(3, 'months', 'days')).toBe(90);
	});

	it('converts years to days using 365-day year', () => {
		expect(toStorage(1, 'years', 'days')).toBe(365);
	});

	it('converts days to hours', () => {
		expect(toStorage(1, 'days', 'hours')).toBe(24);
	});

	it('converts hours to minutes', () => {
		expect(toStorage(2, 'hours', 'minutes')).toBe(120);
	});
});

describe('fromStorage', () => {
	it('picks days when no larger unit fits', () => {
		expect(fromStorage(10, 'days')).toEqual({ amount: 10, unit: 'days' });
	});

	it('promotes 7 days to 1 week', () => {
		expect(fromStorage(7, 'days')).toEqual({ amount: 1, unit: 'weeks' });
	});

	it('promotes 30 days to 1 month', () => {
		expect(fromStorage(30, 'days')).toEqual({ amount: 1, unit: 'months' });
	});

	it('promotes 365 days to 1 year', () => {
		expect(fromStorage(365, 'days')).toEqual({ amount: 1, unit: 'years' });
	});

	it('keeps 1 hour as hours', () => {
		expect(fromStorage(1, 'hours')).toEqual({ amount: 1, unit: 'hours' });
	});

	it('promotes 24 hours to 1 day', () => {
		expect(fromStorage(24, 'hours')).toEqual({ amount: 1, unit: 'days' });
	});

	it('promotes 168 hours to 1 week', () => {
		expect(fromStorage(168, 'hours')).toEqual({ amount: 1, unit: 'weeks' });
	});

	it('keeps 60 hours as hours when no larger unit divides evenly', () => {
		// 60h = 2.5 days, not a whole week/month/year either
		expect(fromStorage(60, 'hours')).toEqual({ amount: 60, unit: 'hours' });
	});

	it('lossy case: 720 hours becomes 1 month (= 30 days)', () => {
		expect(fromStorage(720, 'hours')).toEqual({ amount: 1, unit: 'months' });
	});

	it('handles zero', () => {
		expect(fromStorage(0, 'hours')).toEqual({ amount: 0, unit: 'hours' });
	});
});

describe('toDisplay', () => {
	it('expresses a storage value in the requested unit', () => {
		expect(toDisplay(168, 'hours', 'days')).toBe(7);
	});

	it('keeps zero representable in every unit', () => {
		expect(toDisplay(0, 'hours', 'days')).toBe(0);
		expect(toDisplay(0, 'minutes', 'years')).toBe(0);
	});

	it('returns null when the value is not whole in that unit', () => {
		// 60h = 2.5 days
		expect(toDisplay(60, 'hours', 'days')).toBeNull();
	});

	it('returns the value unchanged when unit equals storage unit', () => {
		expect(toDisplay(90, 'minutes', 'minutes')).toBe(90);
	});
});

describe('ALLOWED_UNITS', () => {
	it('excludes minutes when storage is hours', () => {
		expect(ALLOWED_UNITS.hours).not.toContain('minutes');
	});

	it('excludes hours and minutes when storage is days', () => {
		expect(ALLOWED_UNITS.days).not.toContain('hours');
		expect(ALLOWED_UNITS.days).not.toContain('minutes');
	});

	it('allows all units when storage is minutes', () => {
		expect(ALLOWED_UNITS.minutes).toEqual(['minutes', 'hours', 'days', 'weeks', 'months', 'years']);
	});
});
