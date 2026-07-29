import { describe, it, expect } from 'vitest';
import { isEventFull, getSpotsRemaining } from '$lib/utils/event';
import type { EventInListSchema } from '$lib/api/generated/types.gen';

function makeEvent(overrides: Partial<EventInListSchema> = {}): EventInListSchema {
	return {
		max_attendees: 50,
		attendee_count: 10,
		...overrides
	} as EventInListSchema;
}

// #690: fullness comes from the backend's always-public `is_full` (#825), not
// from `max_attendees`/`attendee_count` — those two are withheld (null) when the
// organizer hides capacity or the count, and deriving from them made a discreet
// sold-out event read as "not full".
describe('isEventFull', () => {
	it('is true when the backend says the event is full', () => {
		expect(isEventFull(makeEvent({ is_full: true }))).toBe(true);
	});

	it('is false when the backend says it is not full', () => {
		expect(isEventFull(makeEvent({ is_full: false }))).toBe(false);
	});

	it('is true even when capacity and count are withheld', () => {
		expect(
			isEventFull(makeEvent({ is_full: true, max_attendees: null, attendee_count: null }))
		).toBe(true);
	});

	it('ignores the raw numbers entirely', () => {
		// Numbers that would have read as "full" under the old derivation.
		expect(isEventFull(makeEvent({ is_full: false, max_attendees: 50, attendee_count: 50 }))).toBe(
			false
		);
	});

	it('is false when the flag is absent', () => {
		expect(isEventFull(makeEvent({ is_full: undefined }))).toBe(false);
	});
});

describe('getSpotsRemaining', () => {
	it('returns the remaining spots', () => {
		expect(getSpotsRemaining(makeEvent({ max_attendees: 50, attendee_count: 10 }))).toBe(40);
	});

	it('never goes below zero', () => {
		expect(getSpotsRemaining(makeEvent({ max_attendees: 50, attendee_count: 60 }))).toBe(0);
	});

	it('returns null when there is no capacity limit', () => {
		expect(getSpotsRemaining(makeEvent({ max_attendees: 0, attendee_count: 10 }))).toBeNull();
	});

	it('returns null when capacity is withheld', () => {
		expect(getSpotsRemaining(makeEvent({ max_attendees: null, attendee_count: 10 }))).toBeNull();
	});

	it('returns null when the attendee count is withheld', () => {
		expect(getSpotsRemaining(makeEvent({ max_attendees: 50, attendee_count: null }))).toBeNull();
	});
});
