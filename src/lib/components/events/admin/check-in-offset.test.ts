import { describe, expect, it } from 'vitest';
import {
	MAX_OFFSET_MINUTES,
	checkInOffsetPayload,
	checkInPickError,
	formatIsoDuration,
	isOffsetInRange,
	isResolvedWindowEmpty,
	offsetFromPicked,
	offsetPickerBounds,
	parseIsoDuration,
	pickedFromOffset,
	splitMinutes
} from './check-in-offset';

describe('parseIsoDuration', () => {
	it.each([
		// Django's long response form, including sign, 0D and zero padding
		['-P0DT01H00M00S', -60],
		['P1DT02H00M00S', 1560],
		['P0DT00H30M00S', 30],
		['P0DT00H00M00S', 0],
		['-P0DT00H00M00S', 0],
		// Short request forms
		['PT2H', 120],
		['-PT30M', -30],
		['P1DT2H', 1560],
		['P1W', 7 * 1440],
		['+PT1H', 60],
		// Seconds round to the nearest minute
		['PT90S', 2],
		['P0DT00H00M29.5S', 0],
		['PT1.5H', 90]
	])('parses %s as %i minutes', (value, expected) => {
		expect(parseIsoDuration(value)).toBe(expected);
	});

	it.each([null, undefined, '', 'P', 'PT', 'P1Y', 'P1M', '1 day', 'garbage'])(
		'returns null for %s',
		(value) => {
			expect(parseIsoDuration(value)).toBeNull();
		}
	);

	it('never returns negative zero', () => {
		expect(Object.is(parseIsoDuration('-PT0S'), 0)).toBe(true);
	});
});

describe('formatIsoDuration', () => {
	it.each([
		[0, 'PT0S'],
		[60, 'PT1H'],
		[-60, '-PT1H'],
		[-30, '-PT30M'],
		[1560, 'P1DT2H'],
		[1440, 'P1D'],
		[1590, 'P1DT2H30M'],
		[-MAX_OFFSET_MINUTES, '-P364D']
	])('formats %i minutes as %s', (minutes, expected) => {
		expect(formatIsoDuration(minutes)).toBe(expected);
	});

	it('round-trips through parseIsoDuration', () => {
		for (const minutes of [-1590, -1, 0, 1, 59, 61, 1439, 1441, MAX_OFFSET_MINUTES]) {
			expect(parseIsoDuration(formatIsoDuration(minutes))).toBe(minutes);
		}
	});
});

describe('splitMinutes', () => {
	it('splits the magnitude', () => {
		expect(splitMinutes(-1590)).toEqual({ days: 1, hours: 2, minutes: 30 });
	});
});

describe('offset <-> picked conversion', () => {
	const start = '2026-10-10T20:00';

	it('computes wall-clock offsets, negative before the start', () => {
		expect(offsetFromPicked(start, '2026-10-10T19:00')).toBe(-60);
		expect(offsetFromPicked(start, '2026-10-11T10:00')).toBe(14 * 60);
	});

	it('ignores DST: a day across a clock change is still exactly 1440 minutes', () => {
		// Europe's 2026 fall-back is Oct 25; the naive strings carry no zone.
		expect(offsetFromPicked('2026-10-24T10:00', '2026-10-25T10:00')).toBe(1440);
		expect(pickedFromOffset('2026-10-24T10:00', 1440)).toBe('2026-10-25T10:00');
	});

	it('crosses month and year boundaries', () => {
		expect(pickedFromOffset('2026-12-31T23:30', 60)).toBe('2027-01-01T00:30');
		expect(pickedFromOffset('2026-03-01T00:30', -60)).toBe('2026-02-28T23:30');
	});

	it('returns null / empty for missing inputs', () => {
		expect(offsetFromPicked('', '2026-10-10T19:00')).toBeNull();
		expect(offsetFromPicked(start, '')).toBeNull();
		expect(pickedFromOffset('', 60)).toBe('');
		expect(pickedFromOffset(start, null)).toBe('');
	});

	it('round-trips', () => {
		expect(offsetFromPicked(start, pickedFromOffset(start, -1590))).toBe(-1590);
	});
});

describe('bounds', () => {
	it('accepts exactly ±364 days and rejects beyond', () => {
		expect(isOffsetInRange(MAX_OFFSET_MINUTES)).toBe(true);
		expect(isOffsetInRange(-MAX_OFFSET_MINUTES)).toBe(true);
		expect(isOffsetInRange(MAX_OFFSET_MINUTES + 1)).toBe(false);
	});

	it('derives picker min/max from the event start', () => {
		expect(offsetPickerBounds('2026-10-10T20:00')).toEqual({
			min: '2025-10-11T20:00',
			max: '2027-10-09T20:00'
		});
		expect(offsetPickerBounds('')).toEqual({});
	});
});

describe('isResolvedWindowEmpty', () => {
	const base = {
		eventStart: '2026-10-10T20:00',
		eventEnd: '2026-10-11T02:00',
		eventCheckInStart: null,
		eventCheckInEnd: null,
		opensOffset: null,
		closesOffset: null
	};

	it('is false for the plain event window', () => {
		expect(isResolvedWindowEmpty(base)).toBe(false);
	});

	it('flags an opens offset past the inherited event end', () => {
		expect(isResolvedWindowEmpty({ ...base, opensOffset: 7 * 60 })).toBe(true);
	});

	it('flags a closes offset before the inherited event check-in start', () => {
		expect(
			isResolvedWindowEmpty({
				...base,
				eventCheckInStart: '2026-10-10T19:00',
				closesOffset: -120
			})
		).toBe(true);
	});

	it('flags equal open and close', () => {
		expect(isResolvedWindowEmpty({ ...base, opensOffset: 60, closesOffset: 60 })).toBe(true);
	});

	it('prefers the event check-in end over the event end', () => {
		expect(
			isResolvedWindowEmpty({ ...base, eventCheckInEnd: '2026-10-11T05:00', opensOffset: 7 * 60 })
		).toBe(false);
	});

	it('stays quiet when the close side cannot be resolved', () => {
		expect(isResolvedWindowEmpty({ ...base, eventEnd: null, opensOffset: 60 })).toBe(false);
	});
});

describe('checkInPickError', () => {
	it('is null for an empty pick or an in-range pick', () => {
		expect(checkInPickError('2026-10-10T20:00', '')).toBeNull();
		expect(checkInPickError('2026-10-10T20:00', '2026-10-10T19:00')).toBeNull();
	});

	it('asks for the event start first', () => {
		expect(checkInPickError('', '2026-10-10T19:00')).toBe('needsEventStart');
	});

	it('flags picks beyond 364 days', () => {
		expect(checkInPickError('2026-10-10T20:00', '2027-10-09T20:01')).toBe('outOfRange');
	});
});

describe('checkInOffsetPayload', () => {
	const start = '2026-10-10T20:00';

	it('sends null when cleared', () => {
		expect(checkInOffsetPayload(start, '', '-P0DT01H00M00S')).toBeNull();
	});

	it('sends a compact duration for a new pick', () => {
		expect(checkInOffsetPayload(start, '2026-10-10T19:00', null)).toBe('-PT1H');
	});

	it('keeps the stored string when unchanged to the minute', () => {
		expect(checkInOffsetPayload(start, '2026-10-10T19:00', '-P0DT01H00M00S')).toBe(
			'-P0DT01H00M00S'
		);
	});

	it('keeps the stored value when the event start is unknown', () => {
		expect(checkInOffsetPayload('', '2026-10-10T19:00', 'PT2H')).toBe('PT2H');
		expect(checkInOffsetPayload('', '2026-10-10T19:00', null)).toBeNull();
	});
});
