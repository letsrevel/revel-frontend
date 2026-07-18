/**
 * Pure per-mode seating fields for the ticket-tier create/update payload.
 *
 * Mirrors server-side per-mode validation: venue only when the tier touches the
 * venue, sector required for user_choice, price category only for
 * best_available. A NONE (general admission) tier MAY link a *standing* sector
 * — its capacity then becomes a hard sale-time cap — so 'none' passes the
 * sector through instead of stripping it. Stale values from a previous mode
 * MUST be nulled (not omitted) because update always sends the full payload.
 */

import type { SeatAssignmentMode } from '$lib/api/generated/types.gen';

export interface TierSeatingFields {
	venue_id: string | null;
	sector_id: string | null;
	price_category_id: string | null;
}

export function buildTierSeatingFields(
	mode: SeatAssignmentMode,
	venueId: string | null,
	sectorId: string | null,
	priceCategoryId: string | null
): TierSeatingFields {
	if (mode === 'none') {
		// GA: optional standing-sector capacity cap. The venue rides along only
		// when a sector is linked (the backend auto-fills it from the sector, but
		// sending it keeps the payload self-consistent); a plain GA tier stays
		// fully null so editing back to GA clears every seating link.
		return {
			venue_id: sectorId ? venueId : null,
			sector_id: sectorId,
			price_category_id: null
		};
	}
	return {
		venue_id: venueId,
		sector_id: mode === 'user_choice' ? sectorId : null,
		price_category_id: mode === 'best_available' ? priceCategoryId : null
	};
}

/**
 * The sector selection that survives a switch to `mode`.
 *
 * Standing sectors are only valid on GA (none) tiers, seated sectors only on
 * user_choice — switching between those modes clears a selection of the wrong
 * kind instead of silently submitting it. best_available keeps the state (the
 * payload builder nulls it), so toggling modes doesn't lose a valid pick.
 */
export function retainedSectorIdForMode(
	mode: SeatAssignmentMode,
	sectorId: string | null,
	standingSectorIds: ReadonlySet<string>
): string | null {
	if (sectorId === null) return null;
	if (mode === 'none') return standingSectorIds.has(sectorId) ? sectorId : null;
	if (mode === 'user_choice') return standingSectorIds.has(sectorId) ? null : sectorId;
	return sectorId;
}
