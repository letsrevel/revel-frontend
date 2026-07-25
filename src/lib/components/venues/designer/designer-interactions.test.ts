import { describe, it, expect } from 'vitest';
import { applyTransform } from '$lib/components/tickets/sector-transform';
import {
	angleFromCenter,
	normalize360,
	nudgedPoint,
	nudgedTransform,
	nudgedVertex,
	resolveRotation,
	rotatedTransform,
	translatedPoint,
	translatedTransform
} from './designer-interactions';

describe('angleFromCenter', () => {
	it('measures degrees clockwise from screen-up', () => {
		const c = { x: 0, y: 0 };
		expect(angleFromCenter(c, { x: 0, y: -1 })).toBeCloseTo(0);
		expect(angleFromCenter(c, { x: 1, y: 0 })).toBeCloseTo(90);
		expect(angleFromCenter(c, { x: 0, y: 1 })).toBeCloseTo(180);
		expect(angleFromCenter(c, { x: -1, y: 0 })).toBeCloseTo(-90);
	});
});

describe('resolveRotation', () => {
	it('snaps to 15° when snapping is on, normalizes otherwise', () => {
		expect(resolveRotation(7, true)).toBe(0);
		expect(resolveRotation(8, true)).toBe(15);
		expect(resolveRotation(-10, false)).toBe(350);
		expect(normalize360(-90)).toBe(270);
	});
});

describe('translatedTransform / translatedPoint', () => {
	it('applies the grab delta and snaps to the 0.5 grid', () => {
		const t = translatedTransform(
			{ x: 0, y: 0, rotation: 20 },
			{ x: 5, y: 5 },
			{ x: 7.1, y: 6 },
			true
		);
		expect(t).toEqual({ x: 2, y: 1, rotation: 20 });
	});
	it('rounds without snapping when snap is off', () => {
		const p = translatedPoint({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1.234567, y: -2 }, false);
		expect(p).toEqual({ x: 1.235, y: -2 });
	});
});

describe('rotatedTransform', () => {
	it('pivots around the block center (center stays fixed)', () => {
		const worldCenter = { x: 5, y: 5 };
		const localCenter = { x: 2, y: 2 };
		const t = rotatedTransform(worldCenter, localCenter, 37, true); // snaps to 30
		expect(t.rotation).toBe(30);
		const placed = applyTransform(localCenter, t);
		expect(placed.x).toBeCloseTo(worldCenter.x);
		expect(placed.y).toBeCloseTo(worldCenter.y);
	});
});

describe('nudge helpers', () => {
	it('nudges a transform position, keeping rotation', () => {
		const t = nudgedTransform({ x: 1, y: 1, rotation: 45 }, 'right', true, false);
		expect(t).toEqual({ x: 1.5, y: 1, rotation: 45 });
	});
	it('nudges a bare point with a large (Shift) step', () => {
		expect(nudgedPoint({ x: 0, y: 0 }, 'down', true, true)).toEqual({ x: 0, y: 2 });
	});
	it('nudges one vertex of a polygon, leaving the rest', () => {
		const next = nudgedVertex(
			[
				{ x: 0, y: 0 },
				{ x: 1, y: 0 }
			],
			0,
			'up',
			true,
			false
		);
		expect(next).toEqual([
			{ x: 0, y: -0.5 },
			{ x: 1, y: 0 }
		]);
	});
});
