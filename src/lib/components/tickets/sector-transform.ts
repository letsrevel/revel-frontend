/**
 * Pure sector-placement geometry for the seat map (no runes, no DOM).
 *
 * A sector's seats and outline shape live in sector-LOCAL coordinates (the
 * grid-derived frame from seat-map-layout.ts). A `SectorTransform` places and
 * rotates that whole local frame into venue "world" space:
 *
 *   world = translate(x, y) ∘ rotate(rotation) · local
 *
 * The transform is persisted per sector under `metadata.transform`, alongside
 * (and never disturbing) the existing `metadata.aisles` contract. Moving or
 * rotating a block writes ONLY the transform (and the sector shape) — never
 * individual seat positions.
 *
 * Angle conventions (documented once, used everywhere):
 * - `rotation` is DEGREES CLOCKWISE on screen (y-down), matching SVG's
 *   `rotate(deg)`, so `applyTransform` and an SVG
 *   `<g transform="translate(x y) rotate(deg)">` agree exactly.
 * - `stageDirectionAngle` returns DEGREES CLOCKWISE FROM SCREEN-UP
 *   (0 = up, 90 = right, 180 = down, 270 = left).
 */
import type { Coordinate2d } from '$lib/api/generated/types.gen';

export interface SectorTransform {
	/** Translation in layout units along world X. */
	x: number;
	/** Translation in layout units along world Y (down is positive). */
	y: number;
	/** Rotation in degrees, clockwise on screen (y-down), matching SVG rotate(). */
	rotation: number;
}

/**
 * Vertical padding (in units) between stacked sectors. Lives here (the home of
 * the stacking transform) and is re-exported by seat-map-layout.ts for its
 * historical consumers.
 */
export const SECTOR_GAP = 2;

/** Normalize a degree value into the half-open range [0, 360). */
export function normalizeDegrees(deg: number): number {
	const wrapped = deg % 360;
	const positive = wrapped < 0 ? wrapped + 360 : wrapped;
	// Collapse -0 to 0 so callers get a clean 0 for the un-rotated case.
	return positive === 0 ? 0 : positive;
}

/**
 * Defensive parse of `metadata.transform` (unknown-shaped JSON). Returns null
 * when absent or when any of x/y/rotation is missing or non-finite, so callers
 * fall back to the stacked default.
 */
export function parseSectorTransform(
	metadata: { [key: string]: unknown } | null | undefined
): SectorTransform | null {
	const raw = metadata?.transform;
	if (typeof raw !== 'object' || raw === null) return null;
	const record = raw as Record<string, unknown>;
	const num = (value: unknown): number | null =>
		typeof value === 'number' && Number.isFinite(value) ? value : null;
	const x = num(record.x);
	const y = num(record.y);
	const rotation = num(record.rotation);
	if (x === null || y === null || rotation === null) return null;
	return { x, y, rotation };
}

/**
 * Place a sector-local point into world space: rotate it clockwise by
 * `t.rotation` (screen y-down), then translate by (t.x, t.y). This mirrors the
 * SVG group transform `translate(x y) rotate(rotation)` applied to the same
 * point.
 */
export function applyTransform(local: Coordinate2d, t: SectorTransform): Coordinate2d {
	const rad = (t.rotation * Math.PI) / 180;
	const cos = Math.cos(rad);
	const sin = Math.sin(rad);
	return {
		x: local.x * cos - local.y * sin + t.x,
		y: local.x * sin + local.y * cos + t.y
	};
}

/**
 * The on-screen angle (degrees clockwise from screen-up) at which the fixed
 * venue stage sits relative to this sector's LOCAL frame.
 *
 * The stage is world "up" (toward −Y). The sector group is rendered with
 * `rotate(rotation)`, which maps a local direction at angle α (clockwise from
 * up) to world angle α + rotation. World-up is world angle 0, so the local
 * angle that faces the stage is α = −rotation. For rotation 0 the stage is
 * straight up (0°); a section turned 90° clockwise sees the stage to its local
 * left (270°).
 */
export function stageDirectionAngle(t: SectorTransform): number {
	return normalizeDegrees(-t.rotation);
}

/**
 * Implicit transform for an un-arranged sector: reproduces today's vertical
 * stacking (x = 0, rotation = 0, y = cumulative offset). `prevStackedHeight` is
 * the summed local height of the sectors stacked before this one; `index` is
 * this sector's ordinal among stacked sectors, so `index * SECTOR_GAP` adds one
 * gap per boundary — matching seat-map-layout's original cursor arithmetic.
 */
export function defaultStackedTransform(index: number, prevStackedHeight: number): SectorTransform {
	return { x: 0, y: prevStackedHeight + index * SECTOR_GAP, rotation: 0 };
}
