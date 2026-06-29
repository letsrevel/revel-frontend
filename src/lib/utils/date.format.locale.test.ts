import { describe, expect, it, vi } from 'vitest';

// Use vi.hoisted so the mock factory runs before module imports, allowing
// per-test locale switching via getLocale.mockReturnValue(). This is the
// same pattern used in calendar.locale.test.ts.
const { getLocale } = vi.hoisted(() => ({ getLocale: vi.fn(() => 'en') }));
vi.mock('$lib/paraglide/runtime.js', () => ({ getLocale }));

import { formatDateLongMonth, formatDateTimeVerbose, formatMonthYearLabel } from './date';

// Fixed UTC noon on 2026-06-07 — well clear of any timezone's date boundary,
// so the calendar day stays "June 7" regardless of the test machine's local zone.
const JUNE_UTC = '2026-06-07T12:00:00Z';

describe('formatDateLongMonth locale switching (#510)', () => {
	it('en → contains "June"', () => {
		getLocale.mockReturnValue('en');
		expect(formatDateLongMonth(JUNE_UTC)).toContain('June');
	});

	it('fr → contains "juin"', () => {
		getLocale.mockReturnValue('fr');
		expect(formatDateLongMonth(JUNE_UTC)).toContain('juin');
	});

	it('de → contains "Juni"', () => {
		getLocale.mockReturnValue('de');
		expect(formatDateLongMonth(JUNE_UTC)).toContain('Juni');
	});
});

describe('formatDateTimeVerbose locale switching (#510)', () => {
	it('en → contains "June" and uses 12-hour AM/PM', () => {
		getLocale.mockReturnValue('en');
		const out = formatDateTimeVerbose(JUNE_UTC);
		expect(out).toContain('June');
		expect(out).toMatch(/AM|PM/);
	});

	it('fr → contains "juin" and does NOT use AM/PM (24-hour)', () => {
		getLocale.mockReturnValue('fr');
		const out = formatDateTimeVerbose(JUNE_UTC);
		expect(out).toContain('juin');
		expect(out).not.toMatch(/AM|PM/);
	});

	it('de → contains "Juni" and does NOT use AM/PM (24-hour)', () => {
		getLocale.mockReturnValue('de');
		const out = formatDateTimeVerbose(JUNE_UTC);
		expect(out).toContain('Juni');
		expect(out).not.toMatch(/AM|PM/);
	});
});

describe('formatMonthYearLabel locale switching (#510)', () => {
	it('en → contains "June 2026"', () => {
		getLocale.mockReturnValue('en');
		expect(formatMonthYearLabel(JUNE_UTC)).toContain('June 2026');
	});

	it('fr → contains "juin 2026"', () => {
		getLocale.mockReturnValue('fr');
		expect(formatMonthYearLabel(JUNE_UTC)).toContain('juin 2026');
	});
});
