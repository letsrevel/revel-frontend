import { describe, it, expect } from 'vitest';
import {
	applyTransform,
	defaultStackedTransform,
	inverseTransform,
	normalizeDegrees,
	parseSectorTransform,
	rotateAboutCenter,
	SECTOR_GAP,
	sectorWorldCenter,
	stageDirectionAngle,
	worldAngleFromUp,
	type SectorTransform
} from './sector-transform';

function close(actual: number, expected: number, eps = 1e-9): void {
	expect(Math.abs(actual - expected)).toBeLessThan(eps);
}

describe('parseSectorTransform', () => {
	it('parses a valid transform', () => {
		expect(parseSectorTransform({ transform: { x: 3, y: -4, rotation: 90 } })).toEqual({
			x: 3,
			y: -4,
			rotation: 90
		});
	});

	it('returns null when absent', () => {
		expect(parseSectorTransform(null)).toBeNull();
		expect(parseSectorTransform(undefined)).toBeNull();
		expect(parseSectorTransform({})).toBeNull();
		expect(parseSectorTransform({ aisles: { verticalAisles: [] } })).toBeNull();
	});

	it('returns null for garbage / partial / non-finite values', () => {
		expect(parseSectorTransform({ transform: 'nope' })).toBeNull();
		expect(parseSectorTransform({ transform: { x: 1, y: 2 } })).toBeNull();
		expect(parseSectorTransform({ transform: { x: '1', y: 2, rotation: 0 } })).toBeNull();
		expect(parseSectorTransform({ transform: { x: NaN, y: 2, rotation: 0 } })).toBeNull();
		expect(parseSectorTransform({ transform: { x: 1, y: Infinity, rotation: 0 } })).toBeNull();
	});
});

describe('applyTransform', () => {
	it('is identity for the zero transform', () => {
		const t: SectorTransform = { x: 0, y: 0, rotation: 0 };
		expect(applyTransform({ x: 5, y: 7 }, t)).toEqual({ x: 5, y: 7 });
	});

	it('translates without rotation', () => {
		const t: SectorTransform = { x: 10, y: -3, rotation: 0 };
		expect(applyTransform({ x: 2, y: 4 }, t)).toEqual({ x: 12, y: 1 });
	});

	it('rotates 90° clockwise (screen y-down): +x -> +y', () => {
		const t: SectorTransform = { x: 0, y: 0, rotation: 90 };
		const p = applyTransform({ x: 1, y: 0 }, t);
		close(p.x, 0);
		close(p.y, 1);
	});

	it('rotates 45° then translates', () => {
		const t: SectorTransform = { x: 100, y: 50, rotation: 45 };
		const p = applyTransform({ x: 1, y: 0 }, t);
		close(p.x, 100 + Math.SQRT1_2);
		close(p.y, 50 + Math.SQRT1_2);
	});

	it('matches an SVG translate∘rotate on a diagonal point', () => {
		// 180° flips both axes.
		const t: SectorTransform = { x: 0, y: 0, rotation: 180 };
		const p = applyTransform({ x: 3, y: 5 }, t);
		close(p.x, -3);
		close(p.y, -5);
	});
});

describe('stageDirectionAngle', () => {
	it('is straight up (0°) at rotation 0', () => {
		expect(stageDirectionAngle({ x: 0, y: 0, rotation: 0 })).toBe(0);
	});

	it('undoes the sector rotation (clockwise-from-up)', () => {
		// Sector turned 90° clockwise -> stage now to its local left (270°).
		expect(stageDirectionAngle({ x: 0, y: 0, rotation: 90 })).toBe(270);
		// Turned 90° counter-clockwise -> stage to its local right (90°).
		expect(stageDirectionAngle({ x: 0, y: 0, rotation: -90 })).toBe(90);
		expect(stageDirectionAngle({ x: 0, y: 0, rotation: 180 })).toBe(180);
		expect(stageDirectionAngle({ x: 0, y: 0, rotation: 30 })).toBe(330);
	});

	it('honors an explicit world angle toward the stage', () => {
		// Stage to world-right (90°), sector unrotated -> local-right (90°).
		expect(stageDirectionAngle({ x: 0, y: 0, rotation: 0 }, 90)).toBe(90);
		// Same stage angle with a 90°-rotated sector -> straight up (0°).
		expect(stageDirectionAngle({ x: 0, y: 0, rotation: 90 }, 90)).toBe(0);
	});
});

describe('worldAngleFromUp', () => {
	it('is clockwise-from-up between two world points', () => {
		expect(worldAngleFromUp({ x: 0, y: 0 }, { x: 0, y: -1 })).toBe(0);
		expect(worldAngleFromUp({ x: 0, y: 0 }, { x: 5, y: 0 })).toBe(90);
		expect(worldAngleFromUp({ x: 0, y: 0 }, { x: 0, y: 3 })).toBe(180);
		expect(worldAngleFromUp({ x: 2, y: 2 }, { x: 2, y: 2 })).toBe(0);
	});
});

describe('inverseTransform / sectorWorldCenter / rotateAboutCenter', () => {
	it('inverseTransform round-trips applyTransform', () => {
		const t: SectorTransform = { x: 7, y: -3, rotation: 42 };
		const local = { x: 2, y: 5 };
		const back = inverseTransform(applyTransform(local, t), t);
		close(back.x, local.x, 1e-9);
		close(back.y, local.y, 1e-9);
	});

	it('sectorWorldCenter maps the local center through the transform', () => {
		const center = sectorWorldCenter({ x: 10, y: 0, rotation: 0 }, 4, 2);
		expect(center).toEqual({ x: 12, y: 1 });
	});

	it('rotateAboutCenter pins the local center at the world center', () => {
		const worldCenter = { x: 5, y: 8 };
		const localCenter = { x: 3, y: 1 };
		const t = rotateAboutCenter(120, localCenter, worldCenter);
		const placed = applyTransform(localCenter, t);
		close(placed.x, worldCenter.x, 1e-9);
		close(placed.y, worldCenter.y, 1e-9);
		expect(t.rotation).toBe(120);
	});
});

describe('normalizeDegrees', () => {
	it('wraps into [0, 360)', () => {
		expect(normalizeDegrees(0)).toBe(0);
		expect(normalizeDegrees(360)).toBe(0);
		expect(normalizeDegrees(-90)).toBe(270);
		expect(normalizeDegrees(450)).toBe(90);
		expect(normalizeDegrees(-450)).toBe(270);
	});
});

describe('defaultStackedTransform', () => {
	it('reproduces the vertical stack (x=0, rotation=0, cumulative y)', () => {
		expect(defaultStackedTransform(0, 0)).toEqual({ x: 0, y: 0, rotation: 0 });
		// Second sector after a first of height h0=3: y = 3 + 1*GAP.
		expect(defaultStackedTransform(1, 3)).toEqual({ x: 0, y: 3 + SECTOR_GAP, rotation: 0 });
		// Third after h0+h1=4: y = 4 + 2*GAP.
		expect(defaultStackedTransform(2, 4)).toEqual({ x: 0, y: 4 + 2 * SECTOR_GAP, rotation: 0 });
	});
});
