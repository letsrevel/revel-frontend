import type { EventInListSchema } from '$lib/api/generated/types.gen';
import { isEventPast } from '$lib/utils/date';

/**
 * An event is "active" for ticket-picker purposes when it has not ended and is
 * not cancelled. `end` is a required string on EventInListSchema (the backend
 * always returns one), so no null handling is needed.
 */
export function isTicketEventActive(event: Pick<EventInListSchema, 'end' | 'status'>): boolean {
	return !isEventPast(event.end) && event.status !== 'cancelled';
}

/**
 * When the org has exactly one ticketed event and it is active, return it so the
 * Tickets tab can deep-link straight to its management page. Otherwise null
 * (render the picker) — this keeps past/cancelled events reachable.
 */
export function shouldRedirectToSingle(events: EventInListSchema[]): EventInListSchema | null {
	if (events.length === 1 && isTicketEventActive(events[0])) {
		return events[0];
	}
	return null;
}

/**
 * Upcoming events first (soonest start first), then past events (most recent
 * first). Pure — returns a new array.
 */
export function sortTicketEventsForPicker(events: EventInListSchema[]): EventInListSchema[] {
	return [...events].sort((a, b) => {
		const aPast = isEventPast(a.end);
		const bPast = isEventPast(b.end);
		if (aPast !== bPast) return aPast ? 1 : -1;
		const aStart = new Date(a.start).getTime();
		const bStart = new Date(b.start).getTime();
		return aPast ? bStart - aStart : aStart - bStart;
	});
}
