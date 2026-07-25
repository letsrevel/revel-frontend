/**
 * Multi-floor venues (#680) — pure logic, no runes, no DOM.
 *
 * Convention (agreed with the backend, validated/documented BE-side):
 * - `venue.metadata.floors = [{ id: string, name: string, order: number }]`
 * - `sector.metadata.floor = <floor id>`
 *
 * Floors are pure presentation: pricing, zones, availability and holds are
 * untouched. Absent or malformed floors metadata means today's single
 * flattened plane — every helper here degrades to that, so existing charts
 * never grow floor UI they did not ask for. The anonymous chart endpoint
 * serves a metadata projection that includes venue `floors` and sector
 * `floor`, so the buyer map reads the exact same convention the designer
 * writes.
 */
import type { VenueChartSchema } from '$lib/api/generated/types.gen';

export interface VenueFloor {
	id: string;
	name: string;
	order: number;
}

type Metadata = { [key: string]: unknown } | null | undefined;

/**
 * Defensive parse of `venue.metadata.floors` into an ordered floor list
 * (lowest `order` first; ties keep array order). ALL-OR-NOTHING: any invalid
 * entry (missing/empty id or name, non-finite order, duplicate id) or a
 * non-array value returns [] — the single flattened plane — rather than a
 * partially-believed floor plan. Extra keys on an entry are tolerated.
 */
export function parseFloors(metadata: Metadata): VenueFloor[] {
	const raw = metadata?.floors;
	if (!Array.isArray(raw)) return [];
	const seen = new Set<string>();
	const floors: VenueFloor[] = [];
	for (const entry of raw) {
		if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return [];
		const { id, name, order } = entry as Record<string, unknown>;
		if (typeof id !== 'string' || id.length === 0) return [];
		if (typeof name !== 'string' || name.trim().length === 0) return [];
		if (typeof order !== 'number' || !Number.isFinite(order)) return [];
		if (seen.has(id)) return [];
		seen.add(id);
		floors.push({ id, name, order });
	}
	return floors.sort((a, b) => a.order - b.order);
}

/**
 * The floor a sector is EXPLICITLY assigned to: `sector.metadata.floor` when
 * it names a known floor id, else null. The designer uses this as the
 * persisted baseline (null = implicit, nothing written).
 */
export function explicitFloorId(metadata: Metadata, floors: readonly VenueFloor[]): string | null {
	const raw = metadata?.floor;
	return typeof raw === 'string' && floors.some((floor) => floor.id === raw) ? raw : null;
}

/**
 * The floor a sector effectively belongs to: its explicit assignment, or —
 * for a missing/unknown `metadata.floor` — the FIRST floor (lowest order).
 * Null only when the venue has no floors at all (flattened plane).
 */
export function sectorFloorId(metadata: Metadata, floors: readonly VenueFloor[]): string | null {
	if (floors.length === 0) return null;
	return explicitFloorId(metadata, floors) ?? floors[0].id;
}

/** A chart reduced to the sectors that effectively belong to one floor. */
export function filterChartToFloor(
	chart: VenueChartSchema,
	floors: readonly VenueFloor[],
	floorId: string | null
): VenueChartSchema {
	return {
		...chart,
		sectors: (chart.sectors ?? []).filter(
			(sector) => sectorFloorId(sector.metadata, floors) === floorId
		)
	};
}

/** Same floor plan? (id/name/order sequences match pairwise). */
export function floorsEqual(a: readonly VenueFloor[], b: readonly VenueFloor[]): boolean {
	if (a.length !== b.length) return false;
	return a.every(
		(floor, index) =>
			floor.id === b[index].id && floor.name === b[index].name && floor.order === b[index].order
	);
}

/**
 * Merge a floor plan into the venue metadata blob without disturbing other
 * keys (`stage`, unknown future keys). Mirrors `mergeStageIntoMetadata`.
 */
export function mergeFloorsIntoMetadata(
	metadata: Record<string, unknown> | null,
	floors: readonly VenueFloor[]
): Record<string, unknown> {
	return {
		...(metadata ?? {}),
		floors: floors.map((floor) => ({ id: floor.id, name: floor.name, order: floor.order }))
	};
}

/**
 * Merge a floor assignment into a sector's metadata blob without disturbing
 * other keys (`transform`, `aisles`, unknown future keys). A null floorId
 * removes the assignment.
 */
export function mergeFloorIntoSectorMetadata(
	metadata: Record<string, unknown> | null,
	floorId: string | null
): Record<string, unknown> {
	const next: Record<string, unknown> = { ...(metadata ?? {}) };
	if (floorId === null) delete next.floor;
	else next.floor = floorId;
	return next;
}

/** A fresh floor id (UUID when available; time+random fallback). */
export function newFloorId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return `floor-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
