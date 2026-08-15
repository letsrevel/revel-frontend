/**
 * The seat-back ORIENTATION NOTCH: one geometry, drawn identically by the
 * sector editor (`venues/SeatRotationNotch.svelte`, inside each grid button)
 * and by the buyer's seat map (`SeatMap.svelte`, inside each seat circle).
 *
 * CONTRACT — `rot` is an ABSOLUTE angle in SECTOR-LOCAL space: degrees
 * CLOCKWISE from "up" (screen −y), normalized to [-180, 180). 0° puts the
 * notch at the top of the seat, i.e. the seat's back is on the stage side of a
 * normally-oriented sector; 90° points it right, 180° down.
 *
 * NEITHER surface compensates for anything:
 * - the editor's `invertRowOrder` is an admin-only labelling/rank convention
 *   the buyer cannot see (it is not in the row-layout recipe the buyer
 *   receives — the recipe is admin-only entirely), so it must not rotate the
 *   notch or the two surfaces would disagree;
 * - the buyer applies the sector's `metadata.transform` rotation to the WHOLE
 *   sector group, notch included — which is correct: the notch is part of the
 *   sector's local frame, exactly like the seat it belongs to.
 *
 * Only a seat with an explicit non-zero rotation gets a notch; unrotated seats
 * stay plain, so a room nobody rotated looks byte-identical to today.
 */
import type { ChartSectorSchema } from '$lib/api/generated/types.gen';

/** Notch start/end as a fraction of the seat radius (both ends stay INSIDE). */
export const NOTCH_INNER = 0.45;
export const NOTCH_OUTER = 0.95;
/** Stroke width as a fraction of the seat radius (so it scales with the seat). */
export const NOTCH_STROKE = 0.18;

/** A notch stroke in seat-LOCAL pixels: the seat's centre is (0, 0). */
export interface NotchSegment {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	/** Stroke width in the same pixels. */
	width: number;
}

function round(value: number): number {
	return Math.round(value * 1000) / 1000;
}

/** Wraps degrees into [-180, 180) (e.g. 200 -> -160, 180 -> -180). */
export function normalizeRotation(value: number): number {
	const wrapped = ((value % 360) + 360) % 360; // [0, 360)
	return wrapped >= 180 ? wrapped - 360 : wrapped;
}

/**
 * The notch stroke for a seat of radius `radius`, drawn at `rot` degrees
 * clockwise from up. Callers translate it by the seat's own centre.
 */
export function notchSegment(rot: number, radius: number): NotchSegment {
	const radians = (rot * Math.PI) / 180;
	// Screen space: y grows DOWNWARD, so "up" is (0, -1) and a positive
	// (clockwise) angle sweeps toward +x.
	const dx = Math.sin(radians);
	const dy = -Math.cos(radians);
	return {
		x1: round(dx * radius * NOTCH_INNER),
		y1: round(dy * radius * NOTCH_INNER),
		x2: round(dx * radius * NOTCH_OUTER),
		y2: round(dy * radius * NOTCH_OUTER),
		width: round(radius * NOTCH_STROKE)
	};
}

/**
 * Defensive parse of `sector.metadata.seatRotations` — the buyer-facing mirror
 * `{ "<seat label>": <degrees clockwise> }` the editor writes on save (the
 * admin-only `rowLayout` recipe it is derived from never reaches this
 * surface). Unknown shapes are tolerated and yield NO rotations, so the map
 * renders exactly as it does today against a backend that does not serve the
 * key at all — deploy order never matters.
 */
export function parseSeatRotations(
	metadata: Record<string, unknown> | null | undefined
): Record<string, number> {
	const raw = metadata?.seatRotations;
	if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
	const rotations: Record<string, number> = {};
	for (const [label, value] of Object.entries(raw as Record<string, unknown>)) {
		if (label === '' || typeof value !== 'number' || !Number.isFinite(value)) continue;
		const rot = normalizeRotation(value);
		// 0 is "not rotated": no notch, and no entry to carry around.
		if (rot === 0) continue;
		rotations[label] = rot;
	}
	return rotations;
}

/**
 * Seat id -> rotation, resolved across a chart's sectors. Labels are unique
 * only WITHIN a sector, so the mirror is read per sector and joined to that
 * sector's own seats; a label with no live seat is simply ignored.
 */
export function buildSeatRotationLookup(
	sectors: readonly ChartSectorSchema[] | null | undefined
): Map<string, number> {
	const lookup = new Map<string, number>();
	for (const sector of sectors ?? []) {
		const rotations = parseSeatRotations(sector.metadata);
		if (Object.keys(rotations).length === 0) continue;
		for (const seat of sector.seats ?? []) {
			const rot = rotations[seat.label];
			if (rot !== undefined) lookup.set(seat.id, rot);
		}
	}
	return lookup;
}
