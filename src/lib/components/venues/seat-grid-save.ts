// Pure helpers turning the seat-grid editor state into API payloads:
// bulk create/update/delete plus paint batches for the venue paint endpoint.
import type {
	AffectedTierSchema,
	SeatPaintResultSchema,
	VenueSeatSchema,
	VenueSeatInputSchema,
	VenueSeatBulkUpdateItemSchema
} from '$lib/api/generated/types.gen';
import type { SeatData } from './seat-grid-types';

/**
 * Union of the affected tiers across a save's paint-batch results (BE #747):
 * one entry per tier, price changes concatenated (each batch reports its own
 * moves), missing categories deduped by id (each batch reports the tier's
 * CURRENT gap, not the delta, so later batches can repeat earlier findings) —
 * without the merge one save would toast the same tier once per batch.
 */
export function mergeAffectedTiers(
	results: readonly SeatPaintResultSchema[]
): AffectedTierSchema[] {
	const byTier = new Map<string, AffectedTierSchema>();
	for (const result of results) {
		for (const tier of result.affected_tiers ?? []) {
			const existing = byTier.get(tier.tier_id);
			if (!existing) {
				byTier.set(tier.tier_id, {
					...tier,
					price_changes: [...(tier.price_changes ?? [])],
					missing_categories: [...(tier.missing_categories ?? [])]
				});
				continue;
			}

			existing.price_changes = [...(existing.price_changes ?? []), ...(tier.price_changes ?? [])];
			const merged = existing.missing_categories ?? [];
			const seen = new Set(merged.map((category) => category.id));
			for (const category of tier.missing_categories ?? []) {
				if (!seen.has(category.id)) merged.push(category);
			}
			existing.missing_categories = merged;
		}
	}
	return [...byTier.values()];
}

/**
 * The affected tiers that warrant a CONFIRMATION rather than an
 * after-the-fact toast: the paint moves live money — a price change on an
 * event that is on sale (open). Draft/closed/cancelled events are reported in
 * the toast only; coverage gaps fail closed (checkout refuses the seats) so
 * they never need a confirmation either.
 */
export function liveRepricedTiers(tiers: readonly AffectedTierSchema[]): AffectedTierSchema[] {
	return tiers.filter(
		(tier) => tier.event_status === 'open' && (tier.price_changes ?? []).length > 0
	);
}

/** One PUT `…/venues/{venue_id}/seats/paint` call: seats sharing one target category. */
export interface PaintBatch {
	price_category_id: string | null;
	seat_ids: string[];
}

/** Everything one editor save must persist, in the order the page applies it. */
export interface SeatSavePlan {
	creates: VenueSeatInputSchema[];
	updates: VenueSeatBulkUpdateItemSchema[];
	deleteLabels: string[];
	/** Paint changes for EXISTING seats — applied after the bulk ops. */
	paintBatches: PaintBatch[];
}

export interface SeatSavePlanInput {
	/** Grid cells keyed by `"row-col"` (logical indices). */
	cells: ReadonlyMap<string, SeatData>;
	existingSeats: VenueSeatSchema[];
	/**
	 * Total grid rows. No longer used to compute `row_order` (that is now a
	 * per-sector dense rank over the POPULATED rows), but retained on the input
	 * contract because the editor still supplies it.
	 */
	rows: number;
	/** True when row A sits at the bottom (furthest row rendered nearest the stage). */
	invertRowOrder: boolean;
	getRowLabel: (rowIndex: number) => string;
	getSeatLabel: (rowIndex: number, colIndex: number) => string;
	/** Rendered x for a column (accounts for vertical aisles). */
	getXPosition: (colIndex: number) => number;
	/** Rendered y for a row (accounts for horizontal aisles). */
	getYPosition: (rowIndex: number) => number;
}

/**
 * Per-sector dense front-to-back rank for a save (0 = closest to the stage).
 *
 * The backend stores explicit ranks verbatim ("explicit wins wholesale") and
 * its own derivation dense-ranks each sector's populated rows to a 0-based
 * front row. We must match that: emitting grid-index-based ranks would offset
 * an inverted sector that doesn't fill the grid to the top (its front row
 * would get a positive rank instead of 0), distorting cross-sector
 * best-available scoring where `row_order` is the primary sort key.
 *
 * Given the distinct populated logical row indices, this returns a lookup that
 * maps each populated row to its dense rank with the front row = 0 in both
 * orientations (the backend has no inversion concept, so we cannot omit the
 * explicit ranks under invert — we send the normalized values ourselves).
 */
export function buildRowOrderLookup(
	populatedRows: readonly number[],
	invertRowOrder: boolean
): (rowIndex: number) => number {
	const sorted = [...new Set(populatedRows)].sort((a, b) => a - b);
	const rank = new Map(sorted.map((r, i) => [r, i]));
	const maxRank = sorted.length - 1;
	return (rowIndex: number) => {
		const r = rank.get(rowIndex) ?? 0;
		return invertRowOrder ? maxRank - r : r;
	};
}

/**
 * Explicit left-to-right rank inside a row: the raw column index. Aisles only
 * shift the rendered x position — adjacency (used for best-available scoring
 * of contiguous seats) still steps by one across an aisle.
 */
export function deriveAdjacencyIndex(colIndex: number): number {
	return colIndex;
}

/**
 * Read a seat's persisted paint (its `price_category_id`) from the admin seats
 * response (BE #734). `undefined` = baseline unknown (never sent on save), `null`
 * = explicitly unpainted, a string = the painted category id.
 */
export function readExistingPaint(seat: VenueSeatSchema): string | null | undefined {
	return seat.price_category_id;
}

/** Black or white — whichever is readable on the given hex swatch color. */
export function paintTextColor(hexColor: string): '#000000' | '#ffffff' {
	const hex = hexColor.replace('#', '');
	const full =
		hex.length === 3
			? hex
					.split('')
					.map((c) => c + c)
					.join('')
			: hex;
	if (!/^[0-9a-fA-F]{6}$/.test(full)) return '#000000';
	const int = Number.parseInt(full, 16);
	const r = (int >> 16) & 255;
	const g = (int >> 8) & 255;
	const b = int & 255;
	// Perceived luminance (ITU-R BT.601)
	const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
	return luminance > 145 ? '#000000' : '#ffffff';
}

function compareBatches(a: PaintBatch, b: PaintBatch): number {
	if (a.price_category_id === null) return b.price_category_id === null ? 0 : 1;
	if (b.price_category_id === null) return -1;
	return a.price_category_id.localeCompare(b.price_category_id);
}

/**
 * Build the full persistence plan for a save.
 *
 * - NEW seats carry `price_category_id` in the bulk-create payload.
 * - EXISTING seats' paint changes are batched for the paint endpoint (grouped
 *   by target category, `null` = unpaint, ids sorted, unpaint batch last).
 *   Seats whose paint was never touched this session (`undefined`) — or whose
 *   touched value matches a known persisted baseline — are not sent.
 * - Both creates and updates carry explicit `row_order`/`adjacency_index`
 *   ranks so editor-built venues get exact best-available scoring.
 */
export function buildSeatSavePlan(input: SeatSavePlanInput): SeatSavePlan {
	const { cells, existingSeats, invertRowOrder } = input;
	const existingByLabel = new Map(existingSeats.map((seat) => [seat.label, seat]));

	// Dense-rank the POPULATED logical rows so the front row is 0 in both
	// orientations, matching the backend's per-sector normalization. Using the
	// grid size here would offset an inverted sector that leaves the top rows
	// empty, distorting cross-sector best-available scoring.
	const populatedRows = [...cells]
		.filter(([, data]) => data.exists)
		.map(([key]) => Number(key.split('-')[0]))
		.filter(Number.isInteger);
	const rowOrderFor = buildRowOrderLookup(populatedRows, invertRowOrder);

	const creates: VenueSeatInputSchema[] = [];
	const updates: VenueSeatBulkUpdateItemSchema[] = [];
	const paintByCategory = new Map<string | null, string[]>();
	const liveLabels = new Set<string>();

	for (const [key, data] of cells) {
		if (!data.exists) continue;
		const [row, col] = key.split('-').map(Number);
		if (!Number.isInteger(row) || !Number.isInteger(col)) continue;

		const label = input.getSeatLabel(row, col);
		liveLabels.add(label);

		const base = {
			label,
			row: input.getRowLabel(row),
			number: col + 1,
			position: { x: input.getXPosition(col), y: input.getYPosition(row) },
			is_accessible: data.is_accessible,
			is_obstructed_view: data.is_obstructed_view,
			is_active: true,
			row_order: rowOrderFor(row),
			adjacency_index: deriveAdjacencyIndex(col)
		};

		const existing = existingByLabel.get(label);
		if (existing) {
			// Paint never rides on bulk update — the paint endpoint owns it.
			updates.push(base);
			if (data.priceCategoryId !== undefined && existing.id) {
				const baseline = readExistingPaint(existing);
				if (baseline === undefined || baseline !== data.priceCategoryId) {
					const bucket = paintByCategory.get(data.priceCategoryId) ?? [];
					bucket.push(existing.id);
					paintByCategory.set(data.priceCategoryId, bucket);
				}
			}
		} else if (data.priceCategoryId !== undefined) {
			creates.push({ ...base, price_category_id: data.priceCategoryId });
		} else {
			creates.push(base);
		}
	}

	const deleteLabels = existingSeats
		.map((seat) => seat.label)
		.filter((label) => !liveLabels.has(label));

	const paintBatches: PaintBatch[] = [...paintByCategory.entries()]
		.map(([price_category_id, seat_ids]) => ({
			price_category_id,
			seat_ids: [...seat_ids].sort()
		}))
		.sort(compareBatches);

	return { creates, updates, deleteLabels, paintBatches };
}
