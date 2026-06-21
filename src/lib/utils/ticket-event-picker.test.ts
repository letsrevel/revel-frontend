import { describe, it, expect, vi, afterEach } from 'vitest';
import type { EventInListSchema } from '$lib/api/generated/types.gen';
import {
	isTicketEventActive,
	shouldRedirectToSingle,
	sortTicketEventsForPicker
} from './ticket-event-picker';

// Fixed "now" so past/future are deterministic.
const NOW = new Date('2026-06-21T12:00:00Z');
const FUTURE = '2026-09-01T18:00:00Z';
const PAST = '2026-01-01T18:00:00Z';

function ev(overrides: Partial<EventInListSchema>): EventInListSchema {
	return {
		id: 'id',
		name: 'Event',
		slug: 'event',
		start: FUTURE,
		end: FUTURE,
		status: 'open',
		requires_ticket: true,
		attendee_count: 0,
		...overrides
	} as EventInListSchema;
}

afterEach(() => vi.useRealTimers());

describe('isTicketEventActive', () => {
	it('true for an upcoming, non-cancelled event', () => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		expect(isTicketEventActive(ev({ end: FUTURE, status: 'open' }))).toBe(true);
	});
	it('false for a past event', () => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		expect(isTicketEventActive(ev({ end: PAST, status: 'open' }))).toBe(false);
	});
	it('false for a cancelled event even if upcoming', () => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		expect(isTicketEventActive(ev({ end: FUTURE, status: 'cancelled' }))).toBe(false);
	});
});

describe('shouldRedirectToSingle', () => {
	it('returns the event when exactly one active event', () => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		const a = ev({ id: 'A', end: FUTURE });
		expect(shouldRedirectToSingle([a])).toBe(a);
	});
	it('returns null when the single event is past', () => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		expect(shouldRedirectToSingle([ev({ id: 'A', end: PAST })])).toBeNull();
	});
	it('returns null when the single event is cancelled', () => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		expect(shouldRedirectToSingle([ev({ id: 'A', status: 'cancelled' })])).toBeNull();
	});
	it('returns null when more than one event (even if one is active)', () => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		const a = ev({ id: 'A', end: FUTURE });
		const b = ev({ id: 'B', end: PAST });
		expect(shouldRedirectToSingle([a, b])).toBeNull();
	});
	it('returns null for an empty list', () => {
		expect(shouldRedirectToSingle([])).toBeNull();
	});
});

describe('sortTicketEventsForPicker', () => {
	it('orders upcoming (asc) before past (desc)', () => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		const upLater = ev({ id: 'up-later', start: '2026-10-01T10:00:00Z', end: '2026-10-01T12:00:00Z' });
		const upSooner = ev({ id: 'up-sooner', start: '2026-07-01T10:00:00Z', end: '2026-07-01T12:00:00Z' });
		const pastOld = ev({ id: 'past-old', start: '2026-01-01T10:00:00Z', end: '2026-01-01T12:00:00Z' });
		const pastRecent = ev({ id: 'past-recent', start: '2026-05-01T10:00:00Z', end: '2026-05-01T12:00:00Z' });
		const sorted = sortTicketEventsForPicker([pastOld, upLater, pastRecent, upSooner]);
		expect(sorted.map((e) => e.id)).toEqual(['up-sooner', 'up-later', 'past-recent', 'past-old']);
	});
	it('does not mutate the input array', () => {
		const input = [ev({ id: 'A' })];
		const copy = [...input];
		sortTicketEventsForPicker(input);
		expect(input).toEqual(copy);
	});
});
