/**
 * Pure helpers for the buyer seat-picker Map/List view toggle (#659).
 *
 * The SVG SeatMap and the SeatSelector row grid are alternative renderings of
 * the same SeatView state; these helpers decide which one to show first
 * (chart-complexity heuristic), persist the buyer's explicit choice for the
 * session, and adapt the availability payload's standing-zone counts for the
 * map. No runes, no DOM beyond guarded sessionStorage — unit-testable.
 */
import type { SeatingAvailabilitySchema, VenueChartSchema } from '$lib/api/generated/types.gen';

export type SeatViewMode = 'map' | 'list';

export const SEAT_VIEW_PREF_KEY = 'revel:seat-view-pref';

/**
 * Default view for a chart: MAP when there is spatial information worth
 * showing — more than one sector, any renderable sector shape (a polygon
 * needs at least 3 points), or more than 60 active seats (a row list that
 * large is hard to scan). Small single-sector charts default to LIST, the
 * fully accessible fallback.
 */
export function defaultSeatViewMode(chart: VenueChartSchema): SeatViewMode {
	const sectors = chart.sectors ?? [];
	if (sectors.length > 1) return 'map';
	if (sectors.some((sector) => (sector.shape?.length ?? 0) >= 3)) return 'map';
	const activeSeats = sectors.reduce(
		(sum, sector) => sum + (sector.seats ?? []).filter((seat) => seat.is_active !== false).length,
		0
	);
	return activeSeats > 60 ? 'map' : 'list';
}

/** The buyer's explicit view choice for this session, if any (SSR-safe). */
export function readSeatViewPref(): SeatViewMode | null {
	if (typeof window === 'undefined') return null;
	try {
		const raw = window.sessionStorage.getItem(SEAT_VIEW_PREF_KEY);
		return raw === 'map' || raw === 'list' ? raw : null;
	} catch {
		return null;
	}
}

/** Remember an explicit view choice for the session (SSR-safe, best-effort). */
export function writeSeatViewPref(mode: SeatViewMode): void {
	if (typeof window === 'undefined') return;
	try {
		window.sessionStorage.setItem(SEAT_VIEW_PREF_KEY, mode);
	} catch {
		// Storage unavailable (private mode, quota) — the default heuristic applies next time.
	}
}

/**
 * Map scope: the tier's own section (readable seat sizes, the default) or the
 * whole venue for spatial context (other sectors render as inert ghosts).
 */
export type SeatMapScope = 'section' | 'venue';

export const SEAT_MAP_SCOPE_PREF_KEY = 'revel:seat-map-scope-pref';

/** The buyer's explicit map-scope choice for this session, if any (SSR-safe). */
export function readSeatMapScopePref(): SeatMapScope | null {
	if (typeof window === 'undefined') return null;
	try {
		const raw = window.sessionStorage.getItem(SEAT_MAP_SCOPE_PREF_KEY);
		return raw === 'section' || raw === 'venue' ? raw : null;
	} catch {
		return null;
	}
}

/** Remember an explicit map-scope choice for the session (SSR-safe, best-effort). */
export function writeSeatMapScopePref(scope: SeatMapScope): void {
	if (typeof window === 'undefined') return;
	try {
		window.sessionStorage.setItem(SEAT_MAP_SCOPE_PREF_KEY, scope);
	} catch {
		// Storage unavailable — the section default applies next time.
	}
}

/**
 * Adapt the availability payload's standing map (unknown-shaped JSON values)
 * into SeatMap's standingCounts prop. Entries without a numeric capacity are
 * dropped (a remaining/total readout is meaningless without one — the map
 * then shows the plain "Standing area" label); missing taken defaults to 0.
 */
export function standingCountsFrom(
	standing: SeatingAvailabilitySchema['standing']
): Record<string, { capacity: number; taken: number }> | undefined {
	if (!standing) return undefined;
	const counts: Record<string, { capacity: number; taken: number }> = {};
	for (const [sectorId, value] of Object.entries(standing)) {
		if (typeof value !== 'object' || value === null) continue;
		const { capacity, taken } = value as { capacity?: unknown; taken?: unknown };
		if (typeof capacity !== 'number' || !Number.isFinite(capacity)) continue;
		counts[sectorId] = { capacity, taken: typeof taken === 'number' ? taken : 0 };
	}
	return Object.keys(counts).length > 0 ? counts : undefined;
}
