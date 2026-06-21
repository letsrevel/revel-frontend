import { describe, expect, it } from 'vitest';
import {
	sessionsToRows,
	rowsToSessions,
	rowCompleteness,
	scheduleRowsValid,
	startsBeforeAnchor,
	emptyRow,
	type ScheduleRow
} from './schedule-rows';
import type { EventScheduleSession } from '$lib/api/generated/types.gen';

// A fixed local anchor. The editor works in `datetime-local` (no zone), so the
// helpers treat both anchor and row starts as the same wall-clock frame —
// offsets are pure elapsed minutes and stay timezone-independent.
const ANCHOR = '2026-07-01T19:00';

function row(overrides: Partial<ScheduleRow> = {}): ScheduleRow {
	return { ...emptyRow(ANCHOR), ...overrides };
}

describe('schedule-rows round-trip', () => {
	it('seeds rows from sessions and re-encodes the same offsets', () => {
		const sessions: EventScheduleSession[] = [
			{ title: 'Doors', offset_minutes: 0, is_required: false },
			{
				title: 'Keynote',
				offset_minutes: 90,
				duration_minutes: 60,
				location: 'Main hall',
				description: 'Opening talk',
				is_required: true
			}
		];

		const rows = sessionsToRows(sessions, ANCHOR);
		expect(rows.map((r) => r.startLocal)).toEqual(['2026-07-01T19:00', '2026-07-01T20:30']);

		const encoded = rowsToSessions(rows, ANCHOR);
		expect(encoded).toEqual([
			{
				title: 'Doors',
				description: null,
				offset_minutes: 0,
				duration_minutes: null,
				location: null,
				is_required: false
			},
			{
				title: 'Keynote',
				description: 'Opening talk',
				offset_minutes: 90,
				duration_minutes: 60,
				location: 'Main hall',
				is_required: true
			}
		]);
	});

	it('sorts encoded sessions by offset regardless of row order', () => {
		const rows = [
			row({ title: 'Late', startLocal: '2026-07-01T21:00' }),
			row({ title: 'Early', startLocal: '2026-07-01T19:30' })
		];
		expect(rowsToSessions(rows, ANCHOR).map((s) => s.title)).toEqual(['Early', 'Late']);
	});

	it('clamps starts before the event to offset 0', () => {
		const rows = [row({ title: 'Pre-show', startLocal: '2026-07-01T18:00' })];
		expect(rowsToSessions(rows, ANCHOR)[0].offset_minutes).toBe(0);
		expect(startsBeforeAnchor(rows[0], ANCHOR)).toBe(true);
	});
});

describe('row completeness & validity', () => {
	it('classifies complete, blank, and invalid rows', () => {
		expect(rowCompleteness(row({ title: 'X', startLocal: ANCHOR }))).toBe('complete');
		expect(rowCompleteness(emptyRow(''))).toBe('blank');
		expect(rowCompleteness(row({ title: 'X', startLocal: '' }))).toBe('invalid');
		expect(rowCompleteness(row({ title: '', startLocal: ANCHOR }))).toBe('invalid');
	});

	it('drops fully-blank rows but keeps complete ones when encoding', () => {
		const rows = [row({ title: 'Real', startLocal: ANCHOR }), emptyRow('')];
		expect(rowsToSessions(rows, ANCHOR)).toHaveLength(1);
	});

	it('is valid alongside an untouched blank row, but not a half-filled one', () => {
		expect(scheduleRowsValid([row({ title: 'X', startLocal: ANCHOR }), emptyRow('')])).toBe(true);
		// A started-but-untitled row is invalid — it blocks save rather than
		// being silently dropped (no accidental data loss).
		expect(scheduleRowsValid([row({ title: '', startLocal: ANCHOR })])).toBe(false);
		expect(scheduleRowsValid([row({ title: 'X', startLocal: '' })])).toBe(false);
	});
});
