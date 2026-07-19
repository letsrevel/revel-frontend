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
 * The on-screen angle (degrees clockwise from screen-up) at which the venue
 * stage sits relative to this sector's LOCAL frame.
 *
 * The sector group is rendered with `rotate(rotation)`, which maps a local
 * direction at angle α (clockwise from up) to world angle α + rotation. So the
 * local angle that faces a stage sitting at `worldAngleToStage` (world degrees
 * clockwise from up) is α = worldAngleToStage − rotation.
 *
 * `worldAngleToStage` defaults to 0 (world "up"), reproducing the historical
 * fixed-stage behaviour: for rotation 0 the stage is straight up (0°); a
 * section turned 90° clockwise sees the stage to its local left (270°). Pass
 * the real angle (see {@link worldAngleFromUp}) once the venue stage has a
 * stored position.
 */
export function stageDirectionAngle(t: SectorTransform, worldAngleToStage = 0): number {
	return normalizeDegrees(worldAngleToStage - t.rotation);
}

/**
 * On-screen angle (degrees clockwise from screen-up, y-down) of the vector
 * `from → to`. Up = 0, right = 90, down = 180, left = 270. Returns 0 for a
 * zero-length vector.
 */
export function worldAngleFromUp(from: Coordinate2d, to: Coordinate2d): number {
	const dx = to.x - from.x;
	const dy = to.y - from.y;
	if (dx === 0 && dy === 0) return 0;
	return normalizeDegrees((Math.atan2(dx, -dy) * 180) / Math.PI);
}

/**
 * World-space center of a sector whose local frame is `[0,width] × [0,height]`,
 * placed by transform `t`. Used to point the buyer map's stage indicator from
 * the sector toward the real stage.
 */
export function sectorWorldCenter(t: SectorTransform, width: number, height: number): Coordinate2d {
	return applyTransform({ x: width / 2, y: height / 2 }, t);
}

/** Inverse of {@link applyTransform}: map a world point back into local space. */
export function inverseTransform(world: Coordinate2d, t: SectorTransform): Coordinate2d {
	const rad = (t.rotation * Math.PI) / 180;
	const cos = Math.cos(rad);
	const sin = Math.sin(rad);
	const dx = world.x - t.x;
	const dy = world.y - t.y;
	return {
		x: dx * cos + dy * sin,
		y: -dx * sin + dy * cos
	};
}

/**
 * Translation `(x, y)` that pins `localCenter` at `worldCenter` for the given
 * rotation — so rotating a block spins it around its own center instead of the
 * local origin: `applyTransform(localCenter, {x, y, rotation}) === worldCenter`.
 */
export function rotateAboutCenter(
	rotation: number,
	localCenter: Coordinate2d,
	worldCenter: Coordinate2d
): SectorTransform {
	const rad = (rotation * Math.PI) / 180;
	const cos = Math.cos(rad);
	const sin = Math.sin(rad);
	const rcx = localCenter.x * cos - localCenter.y * sin;
	const rcy = localCenter.x * sin + localCenter.y * cos;
	return { x: worldCenter.x - rcx, y: worldCenter.y - rcy, rotation };
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
