import { describe, expect, it } from 'vitest';
import {
	formatRecurrence,
	inferBoundaryKind,
	mutualExclusionGuard,
	ordinalLabel,
	parseExdates,
	weekdayLabel
} from './recurrence';
import type { RecurrenceDescriptor } from '$lib/types/recurrence';

const base = (overrides: Partial<RecurrenceDescriptor> = {}): RecurrenceDescriptor => ({
	frequency: 'weekly',
	interval: 1,
	weekdays: [0],
	...overrides
});

describe('weekdayLabel', () => {
	it('returns long English labels by default', () => {
		expect(weekdayLabel(0)).toBe('Monday');
		expect(weekdayLabel(6)).toBe('Sunday');
	});

	it('returns short labels when requested', () => {
		expect(weekdayLabel(2, 'short')).toBe('Wed');
	});

	it('throws on out-of-range input', () => {
		expect(() => weekdayLabel(-1)).toThrow(RangeError);
		expect(() => weekdayLabel(7)).toThrow(RangeError);
		expect(() => weekdayLabel(1.5)).toThrow(RangeError);
	});
});

describe('ordinalLabel', () => {
	it.each([
		[1, 'first'],
		[2, 'second'],
		[3, 'third'],
		[4, 'fourth'],
		[-1, 'last']
	])('returns %s → "%s"', (n, expected) => {
		expect(ordinalLabel(n)).toBe(expected);
	});

	it('throws on unsupported ordinals', () => {
		expect(() => ordinalLabel(0)).toThrow(RangeError);
		expect(() => ordinalLabel(5)).toThrow(RangeError);
	});
});

describe('formatRecurrence — daily', () => {
	it('interval 1 → "Every day"', () => {
		expect(formatRecurrence(base({ frequency: 'daily', weekdays: null }))).toBe('Every day');
	});

	it('interval 3 → "Every 3 days"', () => {
		expect(formatRecurrence(base({ frequency: 'daily', interval: 3, weekdays: null }))).toBe(
			'Every 3 days'
		);
	});
});

describe('formatRecurrence — weekly', () => {
	it('single weekday, interval 1 → "Every Monday"', () => {
		expect(formatRecurrence(base({ weekdays: [0] }))).toBe('Every Monday');
	});

	it('two weekdays, interval 1 → "Every Monday and Wednesday"', () => {
		expect(formatRecurrence(base({ weekdays: [0, 2] }))).toBe('Every Monday and Wednesday');
	});

	it('three weekdays uses Oxford-style list', () => {
		expect(formatRecurrence(base({ weekdays: [0, 2, 4] }))).toBe(
			'Every Monday, Wednesday and Friday'
		);
	});

	it('weekdays come out sorted even if input is not', () => {
		expect(formatRecurrence(base({ weekdays: [4, 0, 2] }))).toBe(
			'Every Monday, Wednesday and Friday'
		);
	});

	it('interval 2 → "Every 2 weeks on …"', () => {
		expect(formatRecurrence(base({ interval: 2, weekdays: [1, 3] }))).toBe(
			'Every 2 weeks on Tuesday and Thursday'
		);
	});

	it('empty weekdays, interval 1 falls back to "Every week"', () => {
		expect(formatRecurrence(base({ weekdays: [] }))).toBe('Every week');
	});

	it('empty weekdays, interval 4 falls back to "Every 4 weeks"', () => {
		expect(formatRecurrence(base({ interval: 4, weekdays: [] }))).toBe('Every 4 weeks');
	});

	it('deduplicates weekdays', () => {
		expect(formatRecurrence(base({ weekdays: [0, 0, 0, 2] }))).toBe('Every Monday and Wednesday');
	});
});

describe('formatRecurrence — monthly (day of month)', () => {
	it('the 1st of every month', () => {
		expect(
			formatRecurrence(base({ frequency: 'monthly', monthly_type: 'day', day_of_month: 1 }))
		).toBe('The 1st of every month');
	});

	it.each([
		[2, '2nd'],
		[3, '3rd'],
		[4, '4th'],
		[11, '11th'],
		[12, '12th'],
		[13, '13th'],
		[21, '21st'],
		[22, '22nd'],
		[23, '23rd'],
		[31, '31st']
	])('ordinal suffix: day %i → "%s"', (day, suffix) => {
		expect(
			formatRecurrence(base({ frequency: 'monthly', monthly_type: 'day', day_of_month: day }))
		).toBe(`The ${suffix} of every month`);
	});

	it('interval 2 → "Every 2 months on the 15th"', () => {
		expect(
			formatRecurrence(
				base({ frequency: 'monthly', monthly_type: 'day', day_of_month: 15, interval: 2 })
			)
		).toBe('Every 2 months on the 15th');
	});

	it('invalid day_of_month falls back to "Every month"', () => {
		expect(
			formatRecurrence(base({ frequency: 'monthly', monthly_type: 'day', day_of_month: 32 }))
		).toBe('Every month');
	});
});

describe('formatRecurrence — monthly (nth weekday)', () => {
	it('second Tuesday of every month', () => {
		expect(
			formatRecurrence(
				base({ frequency: 'monthly', monthly_type: 'weekday', nth_weekday: 2, weekday: 1 })
			)
		).toBe('The second Tuesday of every month');
	});

	it('last Friday of every month', () => {
		expect(
			formatRecurrence(
				base({ frequency: 'monthly', monthly_type: 'weekday', nth_weekday: -1, weekday: 4 })
			)
		).toBe('The last Friday of every month');
	});

	it('interval 3 → "Every 3 months on the first Monday"', () => {
		expect(
			formatRecurrence(
				base({
					frequency: 'monthly',
					monthly_type: 'weekday',
					nth_weekday: 1,
					weekday: 0,
					interval: 3
				})
			)
		).toBe('Every 3 months on the first Monday');
	});

	it('missing weekday falls back', () => {
		expect(
			formatRecurrence(
				base({ frequency: 'monthly', monthly_type: 'weekday', nth_weekday: 1, weekday: null })
			)
		).toBe('Every month');
	});
});

describe('formatRecurrence — yearly', () => {
	it('interval 1 → "Every year"', () => {
		expect(formatRecurrence(base({ frequency: 'yearly', weekdays: null }))).toBe('Every year');
	});

	it('interval 5 → "Every 5 years"', () => {
		expect(formatRecurrence(base({ frequency: 'yearly', interval: 5, weekdays: null }))).toBe(
			'Every 5 years'
		);
	});
});

describe('formatRecurrence — boundary suffix', () => {
	it('appends count boundary', () => {
		expect(formatRecurrence(base({ weekdays: [0], count: 12 }))).toBe(
			'Every Monday for 12 occurrences'
		);
	});

	it('singular count', () => {
		expect(formatRecurrence(base({ weekdays: [0], count: 1 }))).toBe(
			'Every Monday for 1 occurrence'
		);
	});

	it('appends until boundary with locale-formatted date', () => {
		const out = formatRecurrence(
			base({ weekdays: [0], until: '2026-12-31T00:00:00Z' }),
			// Pinning locale keeps the Intl output deterministic across CI runners.
			{ locale: 'en-GB' }
		);
		expect(out).toBe('Every Monday until 31 December 2026');
	});

	it('omits boundary when includeBoundary=false', () => {
		expect(formatRecurrence(base({ weekdays: [0], count: 12 }), { includeBoundary: false })).toBe(
			'Every Monday'
		);
	});

	it('ignores invalid until', () => {
		expect(formatRecurrence(base({ weekdays: [0], until: 'not-a-date' }))).toBe('Every Monday');
	});
});

describe('parseExdates', () => {
	it('returns [] for nullish input', () => {
		expect(parseExdates(null)).toEqual([]);
		expect(parseExdates(undefined)).toEqual([]);
		expect(parseExdates([])).toEqual([]);
	});

	it('parses valid ISO strings in chronological order', () => {
		const result = parseExdates(['2026-02-01T10:00:00Z', '2026-01-01T10:00:00Z']);
		expect(result.map((d) => d.toISOString())).toEqual([
			'2026-01-01T10:00:00.000Z',
			'2026-02-01T10:00:00.000Z'
		]);
	});

	it('silently drops invalid entries', () => {
		const result = parseExdates(['2026-01-01T10:00:00Z', 'garbage', '']);
		expect(result).toHaveLength(1);
	});

	it('drops non-string entries defensively', () => {
		// Generator type says string[], but we accept the hostile input anyway.
		const result = parseExdates(['2026-01-01T10:00:00Z', 42 as unknown as string]);
		expect(result).toHaveLength(1);
	});
});

describe('mutualExclusionGuard', () => {
	it('passes when neither is set', () => {
		expect(mutualExclusionGuard({})).toEqual({ ok: true });
	});

	it('passes when only until is set', () => {
		expect(mutualExclusionGuard({ until: '2026-12-31T00:00:00Z' })).toEqual({ ok: true });
	});

	it('passes when only count is set', () => {
		expect(mutualExclusionGuard({ count: 5 })).toEqual({ ok: true });
	});

	it('fails when both are set', () => {
		expect(mutualExclusionGuard({ until: '2026-12-31T00:00:00Z', count: 5 })).toEqual({
			ok: false,
			reason: 'both_set'
		});
	});

	it('fails when count is zero or negative', () => {
		expect(mutualExclusionGuard({ count: 0 })).toEqual({ ok: false, reason: 'count_invalid' });
		expect(mutualExclusionGuard({ count: -3 })).toEqual({ ok: false, reason: 'count_invalid' });
	});

	it('fails when until is unparseable', () => {
		expect(mutualExclusionGuard({ until: 'nope' })).toEqual({
			ok: false,
			reason: 'until_invalid'
		});
	});
});

describe('inferBoundaryKind', () => {
	it('returns "count" when count is set', () => {
		expect(inferBoundaryKind(base({ count: 12 }))).toBe('count');
	});

	it('returns "until" when until is set', () => {
		expect(inferBoundaryKind(base({ until: '2026-12-31T00:00:00Z' }))).toBe('until');
	});

	it('returns "none" otherwise', () => {
		expect(inferBoundaryKind(base({}))).toBe('none');
	});

	it('prefers count over until if both are somehow set (UI should prevent this)', () => {
		expect(inferBoundaryKind(base({ count: 3, until: '2026-12-31T00:00:00Z' }))).toBe('count');
	});
});
