/**
 * Pure helpers for per-seat-category pricing on user_choice tiers (#668).
 *
 * The backend resolves effective prices server-side (`TicketTierSchema.
 * seat_pricing`): one entry per price category present in the tier's sector
 * plus an explicit `unpainted` fallback. The frontend must do a DUMB lookup —
 * `seat.price_category_id → categories[id].price`, null → `unpainted` — and
 * never reimplement the fallback chain, so the displayed price can't drift
 * from the charged price.
 *
 * A category with `available === false` is painted in the sector but absent
 * from the tier's price map: checkout refuses those seats, so they must be
 * rendered unselectable rather than quoted a price that would sell a 400.
 *
 * No runes here — plain functions so this stays unit-testable.
 */
import type {
	ChartSectorSchema,
	TierSeatPricingSchema,
	VenueChartSchema
} from '$lib/api/generated/types.gen';

export interface SeatPriceInfo {
	/** Decimal string, or null when the seat can't be bought (config gap). */
	price: string | null;
	available: boolean;
	/** Category display name; null for unpainted seats. */
	categoryName: string | null;
}

/** One row of the buyer-facing price legend. */
export interface PriceLegendEntry {
	/** Category id, or null for the unpainted fallback row. */
	id: string | null;
	name: string | null;
	color: string | null;
	price: string | null;
	available: boolean;
}

/** Resolve a seat's effective price from its painted category (dumb lookup). */
export function resolveSeatPrice(
	pricing: TierSeatPricingSchema | null | undefined,
	categoryId: string | null | undefined
): SeatPriceInfo | null {
	if (!pricing) return null;
	if (!categoryId) {
		// `unpainted` is null when no unpainted seat can be bought through this
		// tier (every mapped best-available tier): no honest price exists.
		const unpainted = pricing.unpainted ?? null;
		return { price: unpainted, available: unpainted != null, categoryName: null };
	}
	const category = (pricing.categories ?? []).find((c) => c.id === categoryId);
	if (!category) {
		// Category not listed by the server (e.g. chart newer than the tier
		// payload): don't guess a price, treat the seat as not sellable.
		return { price: null, available: false, categoryName: null };
	}
	return {
		price: category.price ?? null,
		available: category.available !== false && category.price != null,
		categoryName: category.name
	};
}

/**
 * ALLOW-list of categories this tier can honestly sell, or null when the tier
 * has no pricing (flat tier — every seat sellable, grey nothing out).
 *
 * An allow-list, not a deny-list, on purpose: a painted seat is unsellable iff
 * its category is NOT among `seat_pricing.categories` (with a price). A
 * deny-list of the listed-but-unavailable ids would miss a category the stale
 * tier payload has never heard of — e.g. painted onto the sector mid-dialog,
 * where the chart refetches (staleness echo) but the tier prop does not. Such
 * a seat must grey out like a sold one; the checkout 400 is only the backstop.
 * Unpainted seats are never filtered by this set (their price is `unpainted`).
 */
export function sellableCategoryIds(
	pricing: TierSeatPricingSchema | null | undefined
): ReadonlySet<string> | null {
	if (!pricing) return null;
	const ids = new Set<string>();
	for (const category of pricing.categories ?? []) {
		if (category.available !== false && category.price != null) {
			ids.add(category.id);
		}
	}
	return ids;
}

function sectorsInScope(
	chart: VenueChartSchema,
	sectorId: string | null | undefined
): ChartSectorSchema[] {
	return (chart.sectors ?? []).filter((sector) =>
		sectorId ? sector.id === sectorId : (sector.kind ?? 'seated') !== 'standing'
	);
}

/**
 * Legend rows for the seat picker: every category with an active painted seat
 * in scope (tier sector, or all seated sectors), in the server's category
 * order, plus an unpainted fallback row when any in-scope seat is unpainted.
 */
export function priceLegendEntries(
	pricing: TierSeatPricingSchema | null | undefined,
	chart: VenueChartSchema | null | undefined,
	sectorId: string | null | undefined
): PriceLegendEntry[] {
	if (!pricing || !chart) return [];
	const paintedInScope = new Set<string>();
	let hasUnpainted = false;
	for (const sector of sectorsInScope(chart, sectorId)) {
		for (const seat of sector.seats ?? []) {
			if (seat.is_active === false) continue;
			if (seat.price_category_id) {
				paintedInScope.add(seat.price_category_id);
			} else {
				hasUnpainted = true;
			}
		}
	}

	const entries: PriceLegendEntry[] = (pricing.categories ?? [])
		.filter((category) => paintedInScope.has(category.id))
		.map((category) => ({
			id: category.id,
			name: category.name,
			color: category.color,
			price: category.price ?? null,
			available: category.available !== false && category.price != null
		}));

	if (hasUnpainted) {
		entries.push({
			id: null,
			name: null,
			color: null,
			price: pricing.unpainted ?? null,
			available: pricing.unpainted != null
		});
	}
	return entries;
}

/**
 * Sum of the resolved prices of the given seats (display estimate only — the
 * authoritative amount is computed at checkout under the tier lock). Returns
 * null when pricing is absent, no seats are given, or any seat can't be
 * resolved to an honest price.
 */
export function estimatedSeatTotal(
	pricing: TierSeatPricingSchema | null | undefined,
	chart: VenueChartSchema | null | undefined,
	seatIds: readonly string[]
): string | null {
	if (!pricing || !chart || seatIds.length === 0) return null;
	const categoryBySeat = new Map<string, string | null>();
	for (const sector of chart.sectors ?? []) {
		for (const seat of sector.seats ?? []) {
			categoryBySeat.set(seat.id, seat.price_category_id ?? null);
		}
	}
	// Money as integer cents: decimal strings come from the backend with ≤2
	// fraction digits, so this stays exact where float addition wouldn't.
	let totalCents = 0;
	for (const seatId of seatIds) {
		if (!categoryBySeat.has(seatId)) return null;
		const info = resolveSeatPrice(pricing, categoryBySeat.get(seatId));
		if (!info?.available || info.price == null) return null;
		const parsed = Number.parseFloat(info.price);
		if (!Number.isFinite(parsed)) return null;
		totalCents += Math.round(parsed * 100);
	}
	return (totalCents / 100).toFixed(2);
}
