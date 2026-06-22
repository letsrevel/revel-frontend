import { describe, it, expect } from 'vitest';
import { computeCropOutputSize, COVER_ASPECT_RATIO, LOGO_ASPECT_RATIO } from './image-crop';

describe('computeCropOutputSize', () => {
	it('returns the crop size unchanged when it already fits maxOutputSize', () => {
		const out = computeCropOutputSize({ x: 0, y: 0, width: 800, height: 600 }, 1200);
		expect(out).toEqual({ width: 800, height: 600 });
	});

	it('scales down so the longest side equals maxOutputSize, preserving aspect', () => {
		const out = computeCropOutputSize({ x: 0, y: 0, width: 2400, height: 1200 }, 1200);
		expect(out).toEqual({ width: 1200, height: 600 });
	});

	it('caps the taller side for portrait crops', () => {
		const out = computeCropOutputSize({ x: 0, y: 0, width: 1000, height: 2000 }, 1000);
		expect(out).toEqual({ width: 500, height: 1000 });
	});

	it('rounds to integer pixels', () => {
		const out = computeCropOutputSize({ x: 0, y: 0, width: 1000, height: 333 }, 500);
		expect(Number.isInteger(out.width)).toBe(true);
		expect(Number.isInteger(out.height)).toBe(true);
		expect(out.width).toBe(500);
	});

	it('exposes the canonical aspect ratios', () => {
		expect(COVER_ASPECT_RATIO).toBeCloseTo(1200 / 630);
		expect(LOGO_ASPECT_RATIO).toBe(1);
	});
});
