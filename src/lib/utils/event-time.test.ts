import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/paraglide/runtime.js', () => ({ getLocale: () => 'en' }));

import {
	eventZoneDiffersFromViewer,
	formatEventTimeLabel,
	formatEventRangeLabel
} from './event-time';

const SUMMER = '2026-07-10T18:00:00Z'; // Vienna/Berlin 20:00 CEST, London 19:00 BST

describe('eventZoneDiffersFromViewer', () => {
	it('is false for the same zone, same offset zones, or no zone', () => {
		expect(eventZoneDiffersFromViewer(SUMMER, 'Europe/Vienna', 'Europe/Vienna')).toBe(false);
		expect(eventZoneDiffersFromViewer(SUMMER, 'Europe/Vienna', 'Europe/Berlin')).toBe(false);
		expect(eventZoneDiffersFromViewer(SUMMER, null, 'Europe/Berlin')).toBe(false);
		expect(eventZoneDiffersFromViewer(SUMMER, 'Not/AZone', 'Europe/Berlin')).toBe(false);
	});

	it('is true when offsets differ at that instant', () => {
		expect(eventZoneDiffersFromViewer(SUMMER, 'Europe/London', 'Europe/Berlin')).toBe(true);
		expect(eventZoneDiffersFromViewer(SUMMER, 'America/New_York', 'Europe/Berlin')).toBe(true);
	});
});

describe('formatEventTimeLabel', () => {
	it('renders in event zone without label when viewer matches', () => {
		expect(formatEventTimeLabel(SUMMER, 'Europe/Vienna', 'Europe/Berlin')).toBe('8:00 PM');
	});

	it('renders in event zone with abbreviation when viewer differs', () => {
		const label = formatEventTimeLabel(SUMMER, 'Europe/Vienna', 'America/New_York');
		expect(label).toMatch(/^8:00 PM \S+/);
		expect(label.length).toBeGreaterThan('8:00 PM'.length);
	});
});

describe('formatEventRangeLabel', () => {
	it('shows the end date for multi-day events', () => {
		const out = formatEventRangeLabel(
			'2026-07-10T18:00:00Z',
			'2026-07-12T10:00:00Z',
			false,
			'Europe/Vienna',
			'Europe/Berlin'
		);
		expect(out).toContain('Fri, Jul 10');
		expect(out).toContain('Sun, Jul 12');
		expect(out).not.toMatch(/CEST|GMT/);
	});

	it('appends tz only when viewer differs', () => {
		const out = formatEventRangeLabel(
			SUMMER,
			'2026-07-10T21:00:00Z',
			false,
			'Europe/Vienna',
			'America/New_York'
		);
		expect(out).toMatch(/GMT\+2|CEST/);
	});

	it('appends tz when only the end offset differs (range across a DST change)', () => {
		const out = formatEventRangeLabel(
			'2026-03-28T18:00:00Z',
			'2026-03-29T18:00:00Z',
			false,
			'Europe/London',
			'UTC'
		);
		expect(out).toMatch(/GMT\+1|BST/);
		// Open-ended events only look at the start offset.
		const open = formatEventRangeLabel('2026-03-28T18:00:00Z', null, true, 'Europe/London', 'UTC');
		expect(open).not.toMatch(/GMT\+1|BST/);
	});

	it('shows the start date and time only for open-ended events', () => {
		const out = formatEventRangeLabel(
			SUMMER,
			'2026-07-10T21:00:00Z',
			true,
			'Europe/Vienna',
			'Europe/Berlin'
		);
		expect(out).toMatch(/Jul 10/);
		expect(out).toMatch(/8:00 PM$/);
		expect(out).not.toMatch(/11:00 PM/);
	});

	it('does not throw for a time zone unknown to the browser', () => {
		expect(formatEventTimeLabel(SUMMER, 'Not/AZone', 'UTC')).toMatch(/\d{1,2}:\d{2}/);
		const range = formatEventRangeLabel(SUMMER, '2026-07-10T21:00:00Z', false, 'Not/AZone', 'UTC');
		expect(range).toMatch(/Jul 10/);
		const open = formatEventRangeLabel(SUMMER, null, true, 'Not/AZone', 'UTC');
		expect(open).toMatch(/Jul 10/);
	});
});
