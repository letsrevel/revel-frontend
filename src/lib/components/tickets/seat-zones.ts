/**
 * Pure helpers for the buyer-side zone picker on MAPPED best-available tiers
 * (pricing convergence: `category_prices` is the single pricing mechanism).
 *
 * A best-available tier with a non-empty price map sells ZONES: the buyer names
 * one `price_category_id` per hold/checkout request — mandatory even when the
 * tier prices a single zone (the backend deliberately has no default). The
 * options come from `TicketTierSchema.seat_pricing.categories` (server-resolved,
 * exactly the tier's sellable zones); selectability comes from the per-zone
 * availability rows (`SeatingAvailabilitySchema.zones`) scoped to the tier's
 * sector.
 *
 * No runes here — plain functions so this stays unit-testable.
 */
import type {
	TicketTierSchema,
	TierSeatPricingSchema,
	ZoneAvailabilitySchema
} from '$lib/api/generated/types.gen';

/**
 * A mapped best-available tier: the buyer picks a zone, not a seat, and every
 * hold/checkout request must carry its `price_category_id`. An UNMAPPED
 * best-available tier (empty map) sells the whole sector flat at `tier.price`
 * and must NOT send a zone (the backend rejects it).
 */
export function isMappedBestAvailable(
	tier: Pick<TicketTierSchema, 'seat_assignment_mode' | 'seat_pricing'>
): boolean {
	return (
		tier.seat_assignment_mode === 'best_available' &&
		(tier.seat_pricing?.categories?.length ?? 0) > 0
	);
}

/** One selectable zone in the buyer-facing picker. */
export interface ZoneOption {
	id: string;
	name: string;
	color: string | null;
	/** Server-resolved zone price (decimal string). */
	price: string | null;
	/**
	 * Whether a hold for the requested quantity can currently succeed. Exact
	 * (matches the backend's own predicate) up to concurrency; true when the
	 * availability snapshot hasn't loaded yet — the server stays the authority.
	 */
	selectable: boolean;
	/** Selectable seats for "N left" copy; null when availability isn't loaded. */
	freeSeats: number | null;
}

/**
 * Zone options for a mapped best-available tier, in the server's category
 * order. Selectability follows the handoff contract: find the availability row
 * with `sector_id === tierSectorId && price_category_id === zoneId`, then
 * `accessibleRequired ? accessible_free_seats >= quantity :
 * largest_contiguous_block >= quantity`. Sold-out zones are present with
 * zeroes, so a loaded snapshot with no row means the zone has no seats at all.
 */
export function zoneOptions(
	pricing: TierSeatPricingSchema | null | undefined,
	zones: readonly ZoneAvailabilitySchema[] | null | undefined,
	tierSectorId: string | null | undefined,
	quantity: number,
	accessibleRequired: boolean
): ZoneOption[] {
	if (!pricing) return [];
	return (pricing.categories ?? []).map((category) => {
		const row = (zones ?? []).find(
			(zone) =>
				zone.price_category_id === category.id &&
				(tierSectorId ? zone.sector_id === tierSectorId : true)
		);
		if (zones == null) {
			return {
				id: category.id,
				name: category.name,
				color: category.color ?? null,
				price: category.price ?? null,
				selectable: true,
				freeSeats: null
			};
		}
		const freeSeats = accessibleRequired
			? (row?.accessible_free_seats ?? 0)
			: (row?.free_seats ?? 0);
		const holdable = accessibleRequired
			? (row?.accessible_free_seats ?? 0)
			: (row?.largest_contiguous_block ?? 0);
		return {
			id: category.id,
			name: category.name,
			color: category.color ?? null,
			price: category.price ?? null,
			selectable: holdable >= quantity,
			freeSeats
		};
	});
}
