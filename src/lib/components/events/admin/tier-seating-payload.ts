/**
 * Pure per-mode seating fields for the ticket-tier create/update payload.
 *
 * Mirrors server-side per-mode validation after the pricing convergence: a
 * seated tier of EITHER mode requires a sector (the removed price-category FK
 * used to supply the venue for best_available; it no longer exists). A NONE
 * (general admission) tier MAY link a *standing* sector — its capacity then
 * becomes a hard sale-time cap — so 'none' passes the sector through instead
 * of stripping it. Stale values from a previous mode MUST be nulled (not
 * omitted) because update always sends the full payload.
 */

import type { SeatAssignmentMode } from '$lib/api/generated/types.gen';

export interface TierSeatingFields {
	venue_id: string | null;
	sector_id: string | null;
}

export function buildTierSeatingFields(
	mode: SeatAssignmentMode,
	venueId: string | null,
	sectorId: string | null
): TierSeatingFields {
	if (mode === 'none') {
		// GA: optional standing-sector capacity cap. The venue rides along only
		// when a sector is linked (the backend auto-fills it from the sector, but
		// sending it keeps the payload self-consistent); a plain GA tier stays
		// fully null so editing back to GA clears every seating link.
		return {
			venue_id: sectorId ? venueId : null,
			sector_id: sectorId
		};
	}
	return {
		venue_id: venueId,
		sector_id: sectorId
	};
}

/**
 * The `category_prices` field for the tier create/update payload — the single
 * pricing mechanism for BOTH seated modes (pricing convergence). On a
 * user_choice tier a non-empty map must price every painted category (full
 * coverage); on a best_available tier the map's keys DEFINE its sellable
 * zones, so partial coverage is the feature. An empty map means flat
 * `tier.price` across the sector in either mode.
 *
 * PUT semantics with three-way write behavior: omitted/null leaves the stored
 * map untouched, `{}` clears it, non-empty replaces it wholesale. Update always
 * sends the full payload, so blindly serializing the map would WIPE every
 * price on an unrelated field edit — the map is therefore sent ONLY when it
 * actually changed (returns undefined otherwise, spread-omitted by the caller).
 *
 * Empty inputs are dropped (an empty string is "no price", not "price 0"), and
 * switching to a non-seated mode clears a previously stored map the same way
 * stale venue/sector links are nulled above.
 */
export function buildCategoryPricesPayload(
	mode: SeatAssignmentMode,
	baseline: Readonly<Record<string, string>>,
	current: Readonly<Record<string, string>>
): Record<string, string> | undefined {
	const normalized: Record<string, string> = {};
	if (mode !== 'none') {
		for (const [categoryId, value] of Object.entries(current)) {
			const trimmed = value.trim().replace(',', '.');
			if (trimmed !== '') normalized[categoryId] = trimmed;
		}
	}
	const baselineKeys = Object.keys(baseline);
	const changed =
		baselineKeys.length !== Object.keys(normalized).length ||
		baselineKeys.some((key) => baseline[key] !== normalized[key]);
	return changed ? normalized : undefined;
}

/**
 * The sector selection that survives a switch to `mode`.
 *
 * Standing sectors are only valid on GA (none) tiers, seated sectors only on
 * the seated modes — switching between those clears a selection of the wrong
 * kind instead of silently submitting it.
 */
export function retainedSectorIdForMode(
	mode: SeatAssignmentMode,
	sectorId: string | null,
	standingSectorIds: ReadonlySet<string>
): string | null {
	if (sectorId === null) return null;
	if (mode === 'none') return standingSectorIds.has(sectorId) ? sectorId : null;
	return standingSectorIds.has(sectorId) ? null : sectorId;
}
