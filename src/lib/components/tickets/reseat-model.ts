/**
 * Pure helpers for the box-office reseat UI (#663).
 *
 * Backend contract (POST /event-admin/{event_id}/seating/reseat):
 * - `BoxOfficeReseatRequest {ticket_id*, target_seat_id*}` → `AdminTicketSchema`.
 * - The target must be a FREE seat in the SAME price category as the ticket's
 *   current seat; occupied / overridden / foreign-held targets are rejected.
 *
 * The current ticket only carries a `MinimalSeatSchema` (no price_category_id),
 * so the eligible targets are derived from the venue chart (seat → category)
 * joined with availability (free seats). No runes here — unit-testable.
 */
import type { SeatingAvailabilitySchema, VenueChartSchema } from '$lib/api/generated/types.gen';
import { buildSeatViews } from './seating-view';

/** Map every active chart seat id to its price-category id (null = uncategorized). */
export function seatCategoryMap(chart: VenueChartSchema): Map<string, string | null> {
	const map = new Map<string, string | null>();
	for (const sector of chart.sectors ?? []) {
		for (const seat of sector.seats ?? []) {
			if (seat.is_active === false) continue;
			map.set(seat.id, seat.price_category_id ?? null);
		}
	}
	return map;
}

/**
 * Seat ids eligible as reseat targets for the ticket currently on `currentSeatId`:
 * FREE ('available') seats in the SAME price category, excluding the current seat.
 *
 * Returns an empty set when the current seat is not found in the chart (we can't
 * establish its category, so we must not offer a wrong-category target).
 */
export function reseatTargetSeatIds(
	chart: VenueChartSchema,
	availability: SeatingAvailabilitySchema,
	currentSeatId: string | null | undefined
): Set<string> {
	const eligible = new Set<string>();
	if (!currentSeatId) return eligible;

	const categoryMap = seatCategoryMap(chart);
	if (!categoryMap.has(currentSeatId)) return eligible;
	const currentCategory = categoryMap.get(currentSeatId) ?? null;

	const views = buildSeatViews(chart, availability, { myHolds: [], pending: [] });
	for (const seat of views) {
		if (seat.id === currentSeatId) continue;
		if (seat.status !== 'available') continue;
		if ((categoryMap.get(seat.id) ?? null) !== currentCategory) continue;
		eligible.add(seat.id);
	}
	return eligible;
}
