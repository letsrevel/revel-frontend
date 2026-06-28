import { describe, expect, it, vi } from 'vitest';

const { getLocale } = vi.hoisted(() => ({ getLocale: vi.fn(() => 'en') }));
vi.mock('$lib/paraglide/runtime.js', () => ({ getLocale }));

import { formatMonthYear, formatWeekRange, formatCalendarDate } from './calendar';

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
