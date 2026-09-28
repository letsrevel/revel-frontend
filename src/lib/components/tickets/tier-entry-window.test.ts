import { describe, expect, it } from 'vitest';
import { tierEntryWindow } from './tier-entry-window';

const resolved = {
	effective_check_in_opens_at: '2026-10-11T08:00:00Z',
	effective_check_in_closes_at: '2026-10-11T20:00:00Z'
};

describe('tierEntryWindow', () => {
	it('is null when the tier follows the event window', () => {
		expect(tierEntryWindow({ ...resolved, check_in_opens_offset: null }, 'UTC')).toBeNull();
		expect(tierEntryWindow(null)).toBeNull();
	});

	it('is null without resolved times', () => {
		expect(tierEntryWindow({ check_in_opens_offset: 'PT1H' }, 'UTC')).toBeNull();
	});

	it('renders the resolved window in the event timezone when either offset is set', () => {
		const text = tierEntryWindow(
			{ ...resolved, check_in_closes_offset: 'P0DT16H00M00S' },
			'Europe/Vienna'
		);
		// 08:00Z / 20:00Z are 10:00 / 22:00 in Vienna (CEST).
		expect(text).toMatch(/10:00/);
		expect(text).toMatch(/10:00\sPM|22:00/);
	});
});
