/**
 * Map-first tier selection (#679) — pure logic, no runes, no DOM.
 *
 * The whole-venue overview dialog starts from the MAP: every chart sector is
 * mapped to the ticket tiers that sell it (tier.sector links a tier to one
 * sector; a sector can be sold by SEVERAL tiers — the seeded Platea is sold by
 * a user_choice tier AND a best-available tier). Only PURCHASABLE tiers count:
 * a sector with none renders ghosted/inert, so the map never advertises
 * tickets the buyer cannot buy.
 *
 * Also owns the defensive parse of the chart's venue-level stage metadata
 * (`VenueChartSchema.metadata.stage.position`) that places the STAGE pill at
 * the venue's real stage position (missing/malformed → null → SeatMap's
 * top-center fallback).
 */
import type {
	Coordinate2d,
	TierRemainingTicketsSchema,
	VenueChartSchema
} from '$lib/api/generated/types.gen';
import type { TierSchemaWithId } from '$lib/types/tickets';
import { hasTierId } from '$lib/types/tickets';
import { tierPriceDisplay } from '$lib/components/tickets/tier-price-display';

/**
 * A clickable sector on the overview map (consumed by SeatMap's overview
 * mode): the accessible name and the visible overlay lines both carry the
 * tier name(s) + price(s) — information is never conveyed by color alone.
 */
export interface SectorTarget {
	sectorId: string;
	/** Accessible name for the sector button (sector name + tiers + prices). */
	label: string;
	/** Visible overlay lines (one "tier · price" per selling tier). */
	lines: string[];
}

/** How seats are assigned when buying this tier (drives the chooser's hint). */
export type SectorTierMode = 'user_choice' | 'best_available' | 'general';

export interface SectorTierOption {
	tier: TierSchemaWithId;
	/** Honest headline price (range for category-priced tiers, PWYC bounds…). */
	priceDisplay: string;
	mode: SectorTierMode;
}

export interface SectorOverviewEntry {
	sectorId: string;
	sectorName: string;
	/** Purchasable tiers selling this sector, in backend display order. */
	options: SectorTierOption[];
}

export interface SectorOverviewOptions {
	/** Per-user remaining-tickets info (my-status endpoint), when known. */
	remaining?: TierRemainingTicketsSchema[];
	/** Injectable clock for sales-window checks (defaults to now). */
	now?: Date;
}

/**
 * Whether a buyer could start a purchase on this tier right now. Mirrors the
 * gates TierCard applies before showing an enabled action button: visible
 * (not 'hidden'), backend-purchasable, sales window open, inventory left and
 * — when per-user info is available — personal quota not exhausted.
 */
export function isTierPurchasable(
	tier: TierSchemaWithId,
	remaining?: TierRemainingTicketsSchema,
	now: Date = new Date()
): boolean {
	if (!hasTierId(tier)) return false;
	if (tier.payment_method === 'hidden') return false;
	if (tier.can_purchase === false) return false;
	if (tier.total_available === 0) return false;
	if (tier.sales_start_at && now < new Date(tier.sales_start_at)) return false;
	if (tier.sales_end_at && now > new Date(tier.sales_end_at)) return false;
	if (remaining?.sold_out) return false;
	if (remaining && remaining.remaining === 0) return false;
	return true;
}

/** Parse a decimal that may arrive as string or number; NaN-safe. */
function toNumber(value: string | number | null | undefined): number | null {
	if (value == null) return null;
	const parsed = typeof value === 'string' ? parseFloat(value) : value;
	return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Headline price for a tier, delegating to tierPriceDisplay (which renders
 * honest ranges for category-priced tiers via tier.seat_pricing). PWYC bounds
 * mirror the confirmation dialog: min = pwyc_min ?? price, max = pwyc_max.
 */
export function tierPriceLabel(tier: TierSchemaWithId): string {
	const isFree = tier.payment_method === 'free';
	const isPwyc = tier.price_type === 'pwyc';
	const minAmount = toNumber(tier.pwyc_min) ?? toNumber(tier.price) ?? 0;
	const maxAmount = toNumber(tier.pwyc_max);
	return tierPriceDisplay(tier, { isFree, isPwyc, minAmount, maxAmount });
}

/** Seat-assignment mode hint ('none' → general admission / standing). */
export function tierSectorMode(tier: TierSchemaWithId): SectorTierMode {
	if (tier.seat_assignment_mode === 'user_choice') return 'user_choice';
	if (tier.seat_assignment_mode === 'best_available') return 'best_available';
	return 'general';
}

/**
 * One entry per chart sector (seated AND standing), each listing the
 * purchasable tiers that sell it. Tiers without a linked sector never appear;
 * sectors sold by no purchasable tier get an empty options list (the dialog
 * renders them ghosted/inert).
 */
export function buildSectorOverview(
	chart: VenueChartSchema,
	tiers: TierSchemaWithId[],
	opts: SectorOverviewOptions = {}
): SectorOverviewEntry[] {
	const now = opts.now ?? new Date();
	const remainingById = new Map((opts.remaining ?? []).map((r) => [r.tier_id, r]));
	return (chart.sectors ?? []).map((sector) => ({
		sectorId: sector.id,
		sectorName: sector.name,
		options: tiers
			.filter(
				(tier) =>
					tier.sector?.id === sector.id && isTierPurchasable(tier, remainingById.get(tier.id), now)
			)
			.map((tier) => ({ tier, priceDisplay: tierPriceLabel(tier), mode: tierSectorMode(tier) }))
	}));
}

/**
 * Entry-point gate: show "View seating map" only when at least one purchasable
 * tier actually sells a venue sector (cheap tier-only check — the chart itself
 * is fetched lazily when the dialog opens).
 */
export function eventHasSeatingMap(
	tiers: TierSchemaWithId[],
	remaining?: TierRemainingTicketsSchema[],
	now: Date = new Date()
): boolean {
	const remainingById = new Map((remaining ?? []).map((r) => [r.tier_id, r]));
	return tiers.some(
		(tier) => tier.sector?.id != null && isTierPurchasable(tier, remainingById.get(tier.id), now)
	);
}

/**
 * Defensive parse of `VenueChartSchema.metadata.stage.position` (the designer
 * writes `metadata.stage = { position: {x, y}, shape, label? }`). Missing or
 * malformed in any way → null (SeatMap then falls back to its top-center
 * stage pill).
 */
export function parseStageMetadata(
	metadata: { [key: string]: unknown } | null | undefined
): Coordinate2d | null {
	const stage = metadata?.stage;
	if (typeof stage !== 'object' || stage === null) return null;
	const position = (stage as Record<string, unknown>).position;
	if (typeof position !== 'object' || position === null) return null;
	const { x, y } = position as Record<string, unknown>;
	if (typeof x !== 'number' || !Number.isFinite(x)) return null;
	if (typeof y !== 'number' || !Number.isFinite(y)) return null;
	return { x, y };
}
