/**
 * Effective event capacity, mirroring the backend's `Event.effective_capacity`:
 * the smaller of `max_attendees` and the venue capacity, ignoring unset (null /
 * undefined / 0) values. `null` means the event is uncapped.
 */
export function effectiveEventCapacity(
	maxAttendees: number | null | undefined,
	venueCapacity: number | null | undefined
): number | null {
	const limits = [maxAttendees, venueCapacity].filter((v): v is number => !!v);
	return limits.length > 0 ? Math.min(...limits) : null;
}

/** True when a tier quantity is larger than the event capacity (so it can never sell out). */
export function exceedsEventCapacity(
	quantity: number | null | undefined,
	capacity: number | null
): boolean {
	if (capacity === null || capacity === undefined) return false;
	if (quantity === null || quantity === undefined) return false;
	if (!Number.isFinite(quantity) || quantity <= 0) return false;
	return quantity > capacity;
}
