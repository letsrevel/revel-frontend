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

describe('isEventFull', () => {
	it('is true when the count has reached the capacity', () => {
		expect(isEventFull(makeEvent({ max_attendees: 50, attendee_count: 50 }))).toBe(true);
		expect(isEventFull(makeEvent({ max_attendees: 50, attendee_count: 55 }))).toBe(true);
	});

	it('is false below capacity', () => {
		expect(isEventFull(makeEvent({ max_attendees: 50, attendee_count: 49 }))).toBe(false);
	});

	it('is false when there is no capacity limit', () => {
		expect(isEventFull(makeEvent({ max_attendees: 0, attendee_count: 999 }))).toBe(false);
	});

	// #825: capacity and count are withheld (null) when the organizer hides them.
	// Fullness is not assertable then — answering false keeps "Full" off the UI
	// rather than fabricating a verdict from a missing number.
	it('is false when capacity is withheld', () => {
		expect(isEventFull(makeEvent({ max_attendees: null, attendee_count: 999 }))).toBe(false);
	});

	it('is false when the attendee count is withheld', () => {
		expect(isEventFull(makeEvent({ max_attendees: 50, attendee_count: null }))).toBe(false);
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
