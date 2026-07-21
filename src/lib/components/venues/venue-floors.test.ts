import { describe, it, expect } from 'vitest';
import type { VenueChartSchema } from '$lib/api/generated/types.gen';
import {
	explicitFloorId,
	filterChartToFloor,
	floorsEqual,
	mergeFloorIntoSectorMetadata,
	mergeFloorsIntoMetadata,
	newFloorId,
	parseFloors,
	sectorFloorId,
	type VenueFloor
} from './venue-floors';

const ground: VenueFloor = { id: 'g', name: 'Ground floor', order: 0 };
const upper: VenueFloor = { id: 'u', name: 'Upper floor', order: 1 };

describe('parseFloors', () => {
	it('parses a valid list ordered by order (ties keep array order)', () => {
		expect(
			parseFloors({
				floors: [
					{ id: 'u', name: 'Upper floor', order: 1 },
					{ id: 'g', name: 'Ground floor', order: 0 },
					{ id: 'm', name: 'Mezzanine', order: 0 }
				]
			})
		).toEqual([
			{ id: 'g', name: 'Ground floor', order: 0 },
			{ id: 'm', name: 'Mezzanine', order: 0 },
			{ id: 'u', name: 'Upper floor', order: 1 }
		]);
	});

	it('tolerates extra keys on entries', () => {
		expect(parseFloors({ floors: [{ id: 'g', name: 'G', order: 0, future: true }] })).toEqual([
			{ id: 'g', name: 'G', order: 0 }
		]);
	});

	it('returns [] for absent or non-array metadata', () => {
		expect(parseFloors(null)).toEqual([]);
		expect(parseFloors(undefined)).toEqual([]);
		expect(parseFloors({})).toEqual([]);
		expect(parseFloors({ floors: 'ground' })).toEqual([]);
		expect(parseFloors({ floors: { id: 'g' } })).toEqual([]);
	});

	it('returns [] (all-or-nothing) when ANY entry is malformed', () => {
		const good = { id: 'g', name: 'G', order: 0 };
		expect(parseFloors({ floors: [good, null] })).toEqual([]);
		expect(parseFloors({ floors: [good, 'upper'] })).toEqual([]);
		expect(parseFloors({ floors: [good, ['u']] })).toEqual([]);
		expect(parseFloors({ floors: [good, { id: '', name: 'U', order: 1 }] })).toEqual([]);
		expect(parseFloors({ floors: [good, { id: 42, name: 'U', order: 1 }] })).toEqual([]);
		expect(parseFloors({ floors: [good, { id: 'u', order: 1 }] })).toEqual([]);
		expect(parseFloors({ floors: [good, { id: 'u', name: '  ', order: 1 }] })).toEqual([]);
		expect(parseFloors({ floors: [good, { id: 'u', name: 'U', order: '1' }] })).toEqual([]);
		expect(parseFloors({ floors: [good, { id: 'u', name: 'U', order: NaN }] })).toEqual([]);
		expect(parseFloors({ floors: [good, { id: 'u', name: 'U', order: Infinity }] })).toEqual([]);
		// Duplicate ids are malformed too.
		expect(parseFloors({ floors: [good, { id: 'g', name: 'Again', order: 1 }] })).toEqual([]);
	});

	it('returns [] for an empty list (flattened plane)', () => {
		expect(parseFloors({ floors: [] })).toEqual([]);
	});
});

describe('sector→floor resolution', () => {
	const floors = [ground, upper];

	it('explicitFloorId returns only a known assignment', () => {
		expect(explicitFloorId({ floor: 'u' }, floors)).toBe('u');
		expect(explicitFloorId({ floor: 'unknown' }, floors)).toBeNull();
		expect(explicitFloorId({ floor: 7 }, floors)).toBeNull();
		expect(explicitFloorId({}, floors)).toBeNull();
		expect(explicitFloorId(null, floors)).toBeNull();
	});

	it('missing/unknown floor defaults to the FIRST floor (lowest order)', () => {
		expect(sectorFloorId({ floor: 'u' }, floors)).toBe('u');
		expect(sectorFloorId({ floor: 'unknown' }, floors)).toBe('g');
		expect(sectorFloorId({}, floors)).toBe('g');
		expect(sectorFloorId(null, floors)).toBe('g');
	});

	it('is null when the venue has no floors', () => {
		expect(sectorFloorId({ floor: 'u' }, [])).toBeNull();
		expect(explicitFloorId({ floor: 'u' }, [])).toBeNull();
	});
});

describe('filterChartToFloor', () => {
	const chart = {
		venue_id: 'v',
		venue_name: 'Hall',
		updated_at: '',
		metadata: { floors: [ground, upper] },
		sectors: [
			{ id: 'a', name: 'Stalls', kind: 'seated', metadata: null, seats: [] },
			{ id: 'b', name: 'Balcony', kind: 'seated', metadata: { floor: 'u' }, seats: [] },
			{ id: 'c', name: 'Pit', kind: 'standing', metadata: { floor: 'nope' }, seats: [] }
		]
	} as unknown as VenueChartSchema;

	it('keeps only the sectors effectively on the floor', () => {
		const floors = [ground, upper];
		expect(filterChartToFloor(chart, floors, 'g').sectors?.map((s) => s.id)).toEqual(['a', 'c']);
		expect(filterChartToFloor(chart, floors, 'u').sectors?.map((s) => s.id)).toEqual(['b']);
		// Chart-level fields survive untouched.
		expect(filterChartToFloor(chart, floors, 'g').venue_name).toBe('Hall');
	});

	it('with no floors, only a null floorId matches (everything)', () => {
		expect(filterChartToFloor(chart, [], null).sectors).toHaveLength(3);
		expect(filterChartToFloor(chart, [], 'g').sectors).toHaveLength(0);
	});
});

describe('floorsEqual', () => {
	it('compares id/name/order pairwise', () => {
		expect(floorsEqual([ground, upper], [ground, upper])).toBe(true);
		expect(floorsEqual([ground], [ground, upper])).toBe(false);
		expect(floorsEqual([ground, upper], [upper, ground])).toBe(false);
		expect(floorsEqual([{ ...ground, name: 'Renamed' }], [ground])).toBe(false);
		expect(floorsEqual([{ ...ground, order: 5 }], [ground])).toBe(false);
	});
});

describe('metadata merges', () => {
	it('merges floors without clobbering stage or unknown venue keys', () => {
		const merged = mergeFloorsIntoMetadata(
			{ stage: { position: { x: 1, y: 2 } }, capacityNote: 'x' },
			[ground, upper]
		);
		expect(merged).toEqual({
			stage: { position: { x: 1, y: 2 } },
			capacityNote: 'x',
			floors: [
				{ id: 'g', name: 'Ground floor', order: 0 },
				{ id: 'u', name: 'Upper floor', order: 1 }
			]
		});
	});

	it('serializes only id/name/order (no stray fields leak into metadata)', () => {
		const dirty = [{ ...ground, extra: 'nope' } as VenueFloor];
		expect(mergeFloorsIntoMetadata(null, dirty)).toEqual({
			floors: [{ id: 'g', name: 'Ground floor', order: 0 }]
		});
	});

	it('merges a sector floor without clobbering transform/aisles', () => {
		const merged = mergeFloorIntoSectorMetadata(
			{ transform: { x: 1, y: 2, rotation: 0 }, aisles: { verticalAisles: [1] } },
			'u'
		);
		expect(merged).toEqual({
			transform: { x: 1, y: 2, rotation: 0 },
			aisles: { verticalAisles: [1] },
			floor: 'u'
		});
	});

	it('null floorId removes the assignment, keeping other keys', () => {
		expect(mergeFloorIntoSectorMetadata({ floor: 'u', aisles: {} }, null)).toEqual({ aisles: {} });
		expect(mergeFloorIntoSectorMetadata(null, null)).toEqual({});
	});
});

describe('newFloorId', () => {
	it('produces unique non-empty ids', () => {
		const a = newFloorId();
		const b = newFloorId();
		expect(a).toBeTruthy();
		expect(a).not.toBe(b);
	});
});
