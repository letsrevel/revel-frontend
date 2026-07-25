/**
 * Pure state/payload helpers for the box-office door-sale / comp UI (#663).
 *
 * No runes here — plain functions so payload building, recipient validation,
 * seat/tier matching and the payment-method restriction stay unit-testable
 * without rendering the panel.
 *
 * Backend contract (POST /event-admin/{event_id}/seating/sell):
 * - `BoxOfficeSellRequest {seat_id*, tier_id*, payment_method*, email? | user_id?,
 *   guest_name?, first_name?, last_name?}` → `AdminTicketSchema`.
 * - `payment_method` is restricted to 'at_the_door' | 'free' AT THE BOX OFFICE
 *   (online/offline are not door-sale methods) — enforced here, not just by copy.
 * - The recipient is a get-or-create guest keyed by `email` (existing accounts
 *   are reused). We ship email-primary in v1 (no user_id search).
 * - A HELD box-office override on the seat is released as part of the sale; a
 *   KILLED seat is rejected (400); a foreign live hold is rejected (409).
 */
import type {
	BoxOfficeSellRequest,
	TicketTierDetailSchema,
	VenueChartSchema
} from '$lib/api/generated/types.gen';
import type { SeatStatus } from '$lib/components/tickets/seating-view';
import * as m from '$lib/paraglide/messages.js';

/** Payment methods a box-office sale may use (spec §2). */
export type BoxOfficePaymentMethod = 'at_the_door' | 'free';

export const BOX_OFFICE_PAYMENT_METHODS: readonly BoxOfficePaymentMethod[] = [
	'at_the_door',
	'free'
];

/** Localized label for a box-office payment method (radio options). */
export function boxOfficePaymentMethodLabel(method: BoxOfficePaymentMethod): string {
	if (method === 'free') {
		return m['orgAdmin.seating.boxOffice.paymentComp']?.() ?? 'Comp (free)';
	}
	return m['orgAdmin.seating.boxOffice.paymentAtDoor']?.() ?? 'At the door';
}

/**
 * Which seat statuses a box-office sale may target: a free seat ('available')
 * or a box-office HELD override ('blocked' — the backend releases it on sale).
 * 'sold' and a live foreign 'held' are not sellable (the server rejects them).
 */
export function isSellableStatus(status: SeatStatus): boolean {
	return status === 'available' || status === 'blocked';
}

/** Loose email shape check — the backend is the source of truth; this only
 * gates the submit button so a blank/garbage address never reaches the API. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface BuildSellArgs {
	seatId: string | null;
	tierId: string | null;
	paymentMethod: BoxOfficePaymentMethod;
	/** Recipient email (guest get-or-create). Required in v1 (email-primary). */
	email: string;
	firstName: string;
	lastName: string;
}

/**
 * Build the POST body for the current form state, or null when the state is not
 * submittable (no seat, no tier, a non-door payment method, or an invalid
 * email). First/last names are omitted when blank.
 */
export function buildSellRequest(args: BuildSellArgs): BoxOfficeSellRequest | null {
	if (!args.seatId || !args.tierId) return null;
	if (!BOX_OFFICE_PAYMENT_METHODS.includes(args.paymentMethod)) return null;

	const email = args.email.trim();
	if (!EMAIL_RE.test(email)) return null;

	const body: BoxOfficeSellRequest = {
		seat_id: args.seatId,
		tier_id: args.tierId,
		payment_method: args.paymentMethod,
		email
	};

	const first = args.firstName.trim();
	const last = args.lastName.trim();
	if (first) body.first_name = first;
	if (last) body.last_name = last;

	return body;
}

/** The sector id owning `seatId`, or null when the seat is not in the chart. */
export function seatSectorId(chart: VenueChartSchema, seatId: string): string | null {
	for (const sector of chart.sectors ?? []) {
		for (const seat of sector.seats ?? []) {
			if (seat.id === seatId) return sector.id ?? null;
		}
	}
	return null;
}

/** The price-category id of `seatId`, or null when unknown/uncategorized. */
export function seatPriceCategoryId(chart: VenueChartSchema, seatId: string): string | null {
	for (const sector of chart.sectors ?? []) {
		for (const seat of sector.seats ?? []) {
			if (seat.id === seatId) return seat.price_category_id ?? null;
		}
	}
	return null;
}

/** A seated tier is one that assigns seats (mode !== 'none'). */
function isSeatedTier(tier: TicketTierDetailSchema): boolean {
	return tier.seat_assignment_mode !== 'none';
}

/**
 * Does a seated tier apply to a seat in the given sector/category? The
 * declared sector must match, and with a non-empty `category_prices` map
 * (the single pricing mechanism, both modes) the seat's painted category
 * decides: an unpriced painted category is not sellable through the tier
 * (user_choice: a coverage gap checkout refuses; best_available: not one of
 * the tier's zones), and an UNPAINTED seat is sellable only outside mapped
 * best_available (there the pool is filtered to the chosen zone, so an
 * unpainted seat is never a candidate).
 */
function tierMatchesSeat(
	tier: TicketTierDetailSchema,
	sectorId: string | null,
	categoryId: string | null
): boolean {
	const tierSector = tier.sector?.id ?? null;
	if (tierSector !== null && tierSector !== sectorId) return false;
	const priced = tier.category_prices ?? {};
	if (Object.keys(priced).length > 0) {
		if (categoryId === null) return tier.seat_assignment_mode !== 'best_available';
		return categoryId in priced;
	}
	return true;
}

/**
 * Seated tiers sellable for the chosen seat.
 *
 * When no seat is chosen yet, returns all seated tiers. When a seat is chosen,
 * returns the seated tiers whose sector/category match it; if none match (e.g.
 * mixed configuration the FE can't fully resolve), falls back to all seated
 * tiers and lets the backend validate.
 */
export function tiersForSeat(
	tiers: readonly TicketTierDetailSchema[],
	opts: { sectorId: string | null; categoryId: string | null } | null
): TicketTierDetailSchema[] {
	const seated = tiers.filter(isSeatedTier);
	if (!opts) return seated;
	const matched = seated.filter((tier) => tierMatchesSeat(tier, opts.sectorId, opts.categoryId));
	return matched.length > 0 ? matched : seated;
}
