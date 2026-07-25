/**
 * Pure block-transform math for the arranger drags/keys (no runes, no DOM).
 *
 * Kept separate from the controller so the move/rotate/nudge arithmetic — the
 * fiddly part where a rotation must pivot around a block's center and snap to
 * 15° — is unit-testable in isolation.
 */
import type { Coordinate2d } from '$lib/api/generated/types.gen';
import { rotateAboutCenter, type SectorTransform } from '$lib/components/tickets/sector-transform';
import {
	nudgeDelta,
	roundCoord,
	snapAngle,
	snapOrRound,
	type Direction
} from './designer-geometry';

/** Normalize a degree value into [0, 360). */
export function normalize360(deg: number): number {
	return ((deg % 360) + 360) % 360;
}

/**
 * On-screen angle (degrees clockwise from screen-up, y-down) of `center → world`,
 * NOT normalized — callers take differences across a drag, so continuity across
 * the 0/360 seam must be preserved.
 */
export function angleFromCenter(center: Coordinate2d, world: Coordinate2d): number {
	return (Math.atan2(world.x - center.x, -(world.y - center.y)) * 180) / Math.PI;
}

/** Snap a rotation to 15° when snapping is on, else just normalize it. */
export function resolveRotation(raw: number, snapOn: boolean): number {
	return snapOn ? snapAngle(raw) : normalize360(raw);
}

/** Round a transform's fields to kill float drift after rotation math. */
function roundTransform(t: SectorTransform): SectorTransform {
	return { x: roundCoord(t.x), y: roundCoord(t.y), rotation: roundCoord(t.rotation) };
}

/** Translate a block by the world delta from its grab point, keeping rotation. */
export function translatedTransform(
	start: SectorTransform,
	grab: Coordinate2d,
	world: Coordinate2d,
	snapOn: boolean
): SectorTransform {
	const moved = snapOrRound(
		{ x: start.x + (world.x - grab.x), y: start.y + (world.y - grab.y) },
		snapOn
	);
	return { x: moved.x, y: moved.y, rotation: start.rotation };
}

/** Translate a bare point (the stage position) by the world delta from its grab. */
export function translatedPoint(
	start: Coordinate2d,
	grab: Coordinate2d,
	world: Coordinate2d,
	snapOn: boolean
): Coordinate2d {
	return snapOrRound({ x: start.x + (world.x - grab.x), y: start.y + (world.y - grab.y) }, snapOn);
}

/**
 * Rotate a block to `rawRotation` about its center: resolve the snap, then pick
 * the translation that pins `localCenter` at `worldCenter` so the block spins in
 * place instead of orbiting its local origin.
 */
export function rotatedTransform(
	worldCenter: Coordinate2d,
	localCenter: Coordinate2d,
	rawRotation: number,
	snapOn: boolean
): SectorTransform {
	return roundTransform(
		rotateAboutCenter(resolveRotation(rawRotation, snapOn), localCenter, worldCenter)
	);
}

/** Nudge a block's position by one keyboard step, keeping rotation. */
export function nudgedTransform(
	t: SectorTransform,
	direction: Direction,
	snapOn: boolean,
	large: boolean
): SectorTransform {
	const delta = nudgeDelta(direction, snapOn, large);
	return { x: roundCoord(t.x + delta.x), y: roundCoord(t.y + delta.y), rotation: t.rotation };
}

/** Nudge a bare point by one keyboard step. */
export function nudgedPoint(
	point: Coordinate2d,
	direction: Direction,
	snapOn: boolean,
	large: boolean
): Coordinate2d {
	const delta = nudgeDelta(direction, snapOn, large);
	return { x: roundCoord(point.x + delta.x), y: roundCoord(point.y + delta.y) };
}

/** Nudge one polygon vertex by a keyboard step, returning a new points array. */
export function nudgedVertex(
	points: readonly Coordinate2d[],
	index: number,
	direction: Direction,
	snapOn: boolean,
	large: boolean
): Coordinate2d[] {
	const next = points.map((p) => ({ ...p }));
	if (index >= 0 && index < next.length)
		next[index] = nudgedPoint(next[index], direction, snapOn, large);
	return next;
}
