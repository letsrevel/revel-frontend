import { describe, expect, it } from 'vitest';
import type { ChartSectorSchema } from '$lib/api/generated/types.gen';
import {
	NOTCH_INNER,
	NOTCH_OUTER,
	NOTCH_STROKE,
	buildSeatRotationLookup,
	normalizeRotation,
	notchSegment,
	parseSeatRotations
} from './seat-rotation';

function sector(overrides: Partial<ChartSectorSchema> = {}): ChartSectorSchema {
	return {
		id: 'sec-1',
		name: 'Stalls',
		kind: 'seated',
		seats: [
			{ id: 'seat-a1', label: 'A1' },
			{ id: 'seat-a2', label: 'A2' }
		],
		...overrides
	} as ChartSectorSchema;
}

describe('notchSegment', () => {
	it('points a 0-degree notch straight UP (screen -y) from the seat centre', () => {
		const notch = notchSegment(0, 20);
		expect(notch.x1).toBeCloseTo(0, 6);
		expect(notch.x2).toBeCloseTo(0, 6);
		// Both ends above the centre, the outer one further out.
		expect(notch.y1).toBeCloseTo(-20 * NOTCH_INNER, 3);
		expect(notch.y2).toBeCloseTo(-20 * NOTCH_OUTER, 3);
	});

	it('sweeps CLOCKWISE: 90 points right, 180 down, -90 left', () => {
		expect(notchSegment(90, 10).x2).toBeCloseTo(10 * NOTCH_OUTER, 3);
		expect(notchSegment(90, 10).y2).toBeCloseTo(0, 6);
		expect(notchSegment(180, 10).y2).toBeCloseTo(10 * NOTCH_OUTER, 3);
		expect(notchSegment(-90, 10).x2).toBeCloseTo(-10 * NOTCH_OUTER, 3);
	});

	it('stays INSIDE the seat and scales with its radius', () => {
		for (const radius of [11, 20]) {
			for (const rot of [0, 37, 90, 143, -160]) {
				const notch = notchSegment(rot, radius);
				expect(Math.hypot(notch.x2, notch.y2)).toBeLessThan(radius);
				expect(Math.hypot(notch.x1, notch.y1)).toBeLessThan(Math.hypot(notch.x2, notch.y2));
			}
			expect(notchSegment(0, radius).width).toBeCloseTo(radius * NOTCH_STROKE, 3);
		}
	});

	it('is the SAME shape at both surfaces scales — geometry is radius-relative', () => {
		// The editor's seat radius is 20px (BUTTON_PX / 2), the buyer's is 11px
		// (SEAT_R): the notch must be the same fraction of the seat on both.
		const editor = notchSegment(35, 20);
		const buyer = notchSegment(35, 11);
		expect(editor.x2 / 20).toBeCloseTo(buyer.x2 / 11, 3);
		expect(editor.y2 / 20).toBeCloseTo(buyer.y2 / 11, 3);
	});
});

describe('normalizeRotation', () => {
	it('wraps into [-180, 180)', () => {
		expect(normalizeRotation(0)).toBe(0);
		expect(normalizeRotation(200)).toBe(-160);
		expect(normalizeRotation(-200)).toBe(160);
		expect(normalizeRotation(180)).toBe(-180);
		expect(normalizeRotation(-180)).toBe(-180);
		expect(normalizeRotation(720 + 45)).toBe(45);
	});
});

describe('parseSeatRotations — defensive', () => {
	it('reads a well-formed mirror', () => {
		expect(parseSeatRotations({ seatRotations: { A1: 15, A2: -30 } })).toEqual({
			A1: 15,
			A2: -30
		});
	});

	it('yields nothing when the key is absent, or the metadata is', () => {
		expect(parseSeatRotations(null)).toEqual({});
		expect(parseSeatRotations(undefined)).toEqual({});
		expect(parseSeatRotations({})).toEqual({});
		expect(parseSeatRotations({ aisles: { verticalAisles: [] } })).toEqual({});
	});

	it('tolerates every malformed shape instead of throwing', () => {
		expect(parseSeatRotations({ seatRotations: 'garbage' })).toEqual({});
		expect(parseSeatRotations({ seatRotations: [1, 2, 3] })).toEqual({});
		expect(parseSeatRotations({ seatRotations: null })).toEqual({});
		expect(parseSeatRotations({ seatRotations: 42 })).toEqual({});
	});

	it('drops entries that are not finite numbers, keeping the good ones', () => {
		expect(
			parseSeatRotations({
				seatRotations: {
					A1: 15,
					A2: 'ninety',
					A3: null,
					A4: Number.NaN,
					A5: Number.POSITIVE_INFINITY,
					A6: { deg: 30 },
					'': 45
				}
			})
		).toEqual({ A1: 15 });
	});

	it('normalizes degrees and drops the zeroes (0 = not rotated)', () => {
		expect(parseSeatRotations({ seatRotations: { A1: 200, A2: 0, A3: 360, A4: -180 } })).toEqual({
			A1: -160,
			A4: -180
		});
	});
});

describe('buildSeatRotationLookup', () => {
	it('keys rotations by SEAT ID, resolved per sector', () => {
		const lookup = buildSeatRotationLookup([
			sector({ metadata: { seatRotations: { A1: 90 } } }),
			sector({
				id: 'sec-2',
				// Same labels in another sector — labels are unique per sector only.
				seats: [
					{ id: 'seat-b-a1', label: 'A1' },
					{ id: 'seat-b-a2', label: 'A2' }
				],
				metadata: { seatRotations: { A2: -45 } }
			} as Partial<ChartSectorSchema>)
		]);
		expect(lookup.get('seat-a1')).toBe(90);
		expect(lookup.has('seat-a2')).toBe(false);
		expect(lookup.has('seat-b-a1')).toBe(false);
		expect(lookup.get('seat-b-a2')).toBe(-45);
	});

	it('is empty for absent/malformed metadata and for labels with no live seat', () => {
		expect(buildSeatRotationLookup(undefined).size).toBe(0);
		expect(buildSeatRotationLookup([sector()]).size).toBe(0);
		expect(buildSeatRotationLookup([sector({ metadata: { seatRotations: 7 } })]).size).toBe(0);
		expect(
			buildSeatRotationLookup([sector({ metadata: { seatRotations: { Z9: 30 } } })]).size
		).toBe(0);
	});

	it('ignores a seatless (standing) sector carrying the key', () => {
		const lookup = buildSeatRotationLookup([
			sector({ kind: 'standing', seats: [], metadata: { seatRotations: { A1: 30 } } })
		]);
		expect(lookup.size).toBe(0);
	});
});
