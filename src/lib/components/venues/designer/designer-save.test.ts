import { describe, it, expect } from 'vitest';
import type { Coordinate2d } from '$lib/api/generated/types.gen';
import type { DesignerModel, DesignerSeat, DesignerSector } from './designer-model';
import {
	anyShapeChanged,
	buildSavePlan,
	countChangedSeats,
	positionsDiffer,
	seatBatchErrorMessage,
	shapeUpdateErrorMessage,
	type SavePlanInput
} from './designer-save';

function sector(id: string, overrides: Partial<DesignerSector> = {}): DesignerSector {
	return {
		id,
		name: `Sector ${id}`,
		origin: { x: 0, y: 0 },
		frameOffset: { x: 0, y: 0 },
		hasCompletePositions: true,
		shape: null,
		width: 4,
		height: 4,
		hasSeats: true,
		...overrides
	};
}

function dSeat(id: string, sectorId: string, x: number, y: number): DesignerSeat {
	return {
		id,
		label: id.toUpperCase(),
		sectorId,
		x,
		y,
		isAccessible: false,
		isObstructedView: false
	};
}

function positionsOf(seats: DesignerSeat[]): Map<string, Coordinate2d> {
	return new Map(seats.map((seat) => [seat.id, { x: seat.x, y: seat.y }]));
}

function makeInput(model: DesignerModel, overrides: Partial<SavePlanInput> = {}): SavePlanInput {
	return {
		model,
		positions: positionsOf(model.seats),
		baselinePositions: positionsOf(model.seats),
		shapes: new Map(),
		baselineShapes: new Map(),
		...overrides
	};
}

describe('positionsDiffer', () => {
	it('is epsilon-tolerant and handles missing values', () => {
		expect(positionsDiffer({ x: 1, y: 1 }, { x: 1, y: 1.0001 })).toBe(false);
		expect(positionsDiffer({ x: 1, y: 1 }, { x: 1, y: 1.01 })).toBe(true);
		expect(positionsDiffer(undefined, { x: 1, y: 1 })).toBe(true);
		expect(positionsDiffer(undefined, undefined)).toBe(false);
	});
});

describe('buildSavePlan', () => {
	it('returns an empty plan when nothing changed', () => {
		const model: DesignerModel = {
			sectors: [sector('a')],
			seats: [dSeat('s1', 'a', 0, 0)],
			width: 4,
			height: 4
		};
		const plan = buildSavePlan(makeInput(model));
		expect(plan.isEmpty).toBe(true);
		expect(plan.seatBatches).toEqual([]);
		expect(plan.shapeUpdates).toEqual([]);
	});

	it('writes only the changed seats for a complete-positions sector, in the persist frame', () => {
		const sec = sector('a', { origin: { x: 0, y: 10 }, frameOffset: { x: 5, y: 7 } });
		const seats = [dSeat('s1', 'a', 0, 10), dSeat('s2', 'a', 1, 10)];
		const model: DesignerModel = { sectors: [sec], seats, width: 4, height: 12 };
		const positions = positionsOf(seats);
		positions.set('s2', { x: 2.5, y: 11 });

		const plan = buildSavePlan(makeInput(model, { positions }));
		expect(plan.seatBatches).toHaveLength(1);
		expect(plan.seatBatches[0].sectorId).toBe('a');
		// persisted = global - origin + frameOffset
		expect(plan.seatBatches[0].seats).toEqual([{ label: 'S2', position: { x: 7.5, y: 8 } }]);
	});

	it('materializes ALL seats of a sector that lacked complete positions', () => {
		const sec = sector('a', { hasCompletePositions: false });
		const seats = [dSeat('s1', 'a', 0, 0), dSeat('s2', 'a', 1, 0), dSeat('s3', 'a', 2, 0)];
		const model: DesignerModel = { sectors: [sec], seats, width: 4, height: 4 };
		const positions = positionsOf(seats);
		positions.set('s1', { x: 0, y: 2 });

		const plan = buildSavePlan(makeInput(model, { positions }));
		expect(plan.seatBatches).toHaveLength(1);
		expect(plan.seatBatches[0].seats.map((s) => s.label)).toEqual(['S1', 'S2', 'S3']);
	});

	it('splits seat writes into batches of batchSize', () => {
		const sec = sector('a', { hasCompletePositions: false });
		const seats = [dSeat('s1', 'a', 0, 0), dSeat('s2', 'a', 1, 0), dSeat('s3', 'a', 2, 0)];
		const model: DesignerModel = { sectors: [sec], seats, width: 4, height: 4 };
		const positions = positionsOf(seats);
		positions.set('s1', { x: 0, y: 2 });

		const plan = buildSavePlan(makeInput(model, { positions, batchSize: 2 }));
		expect(plan.seatBatches.map((b) => b.seats.length)).toEqual([2, 1]);
	});

	it('emits shape updates in the persist frame, and null to clear', () => {
		const secA = sector('a', { origin: { x: 0, y: 0 }, frameOffset: { x: 1, y: 1 } });
		const secB = sector('b', {
			origin: { x: 0, y: 6 },
			shape: [
				{ x: 0, y: 6 },
				{ x: 2, y: 6 },
				{ x: 1, y: 8 }
			]
		});
		const model: DesignerModel = { sectors: [secA, secB], seats: [], width: 4, height: 10 };
		const triangle = [
			{ x: 0, y: 0 },
			{ x: 3, y: 0 },
			{ x: 0, y: 3 }
		];
		const plan = buildSavePlan(
			makeInput(model, {
				shapes: new Map<string, Coordinate2d[] | null>([
					['a', triangle],
					['b', null]
				]),
				baselineShapes: new Map<string, Coordinate2d[] | null>([
					['a', null],
					['b', secB.shape]
				])
			})
		);
		expect(plan.shapeUpdates).toEqual([
			{
				sectorId: 'a',
				sectorName: 'Sector a',
				shape: [
					{ x: 1, y: 1 },
					{ x: 4, y: 1 },
					{ x: 1, y: 4 }
				]
			},
			{ sectorId: 'b', sectorName: 'Sector b', shape: null }
		]);
	});

	it('flags an edited shape with fewer than 3 points and withholds all writes for that sector', () => {
		const sec = sector('a');
		const seats = [dSeat('s1', 'a', 0, 0)];
		const model: DesignerModel = { sectors: [sec], seats, width: 4, height: 4 };
		const positions = positionsOf(seats);
		positions.set('s1', { x: 1, y: 1 });

		const plan = buildSavePlan(
			makeInput(model, {
				positions,
				shapes: new Map<string, Coordinate2d[] | null>([
					[
						'a',
						[
							{ x: 0, y: 0 },
							{ x: 1, y: 1 }
						]
					]
				])
			})
		);
		expect(plan.invalidShapeSectors).toEqual([{ sectorId: 'a', sectorName: 'Sector a' }]);
		expect(plan.seatBatches).toEqual([]);
		expect(plan.shapeUpdates).toEqual([]);
		expect(plan.isEmpty).toBe(false);
	});

	it('reports moved seats outside the shape as violations and withholds the sector writes', () => {
		const triangle = [
			{ x: 0, y: 0 },
			{ x: 4, y: 0 },
			{ x: 0, y: 4 }
		];
		const sec = sector('a', { shape: triangle });
		const seats = [dSeat('s1', 'a', 1, 1), dSeat('s2', 'a', 0.5, 0.5)];
		const model: DesignerModel = { sectors: [sec], seats, width: 4, height: 4 };
		const positions = positionsOf(seats);
		positions.set('s1', { x: 5, y: 5 }); // clearly outside

		const plan = buildSavePlan(
			makeInput(model, {
				positions,
				shapes: new Map<string, Coordinate2d[] | null>([['a', triangle]]),
				baselineShapes: new Map<string, Coordinate2d[] | null>([['a', triangle]])
			})
		);
		expect(plan.violations).toEqual([
			{ sectorId: 'a', sectorName: 'Sector a', seatLabels: ['S1'] }
		]);
		expect(plan.seatBatches).toEqual([]);
	});

	it('validates ALL sector seats when the shape itself changed', () => {
		const sec = sector('a');
		// s2 never moved, but the new shape strands it.
		const seats = [dSeat('s1', 'a', 1, 1), dSeat('s2', 'a', 3.5, 3.5)];
		const model: DesignerModel = { sectors: [sec], seats, width: 6, height: 6 };
		const smallTriangle = [
			{ x: 0, y: 0 },
			{ x: 3, y: 0 },
			{ x: 0, y: 3 }
		];
		const plan = buildSavePlan(
			makeInput(model, {
				shapes: new Map<string, Coordinate2d[] | null>([['a', smallTriangle]])
			})
		);
		expect(plan.violations).toEqual([
			{ sectorId: 'a', sectorName: 'Sector a', seatLabels: ['S2'] }
		]);
		expect(plan.shapeUpdates).toEqual([]);
	});
});

describe('countChangedSeats / anyShapeChanged', () => {
	it('counts epsilon-significant moves and detects shape edits', () => {
		const seats = [dSeat('s1', 'a', 0, 0), dSeat('s2', 'a', 1, 0)];
		const model: DesignerModel = { sectors: [sector('a')], seats, width: 4, height: 4 };
		const positions = positionsOf(seats);
		positions.set('s2', { x: 1, y: 1 });
		expect(countChangedSeats(model, positions, positionsOf(seats))).toBe(1);

		const tri = [
			{ x: 0, y: 0 },
			{ x: 1, y: 0 },
			{ x: 0, y: 1 }
		];
		expect(
			anyShapeChanged(
				[{ id: 'a' }],
				new Map<string, Coordinate2d[] | null>([['a', tri]]),
				new Map<string, Coordinate2d[] | null>([['a', null]])
			)
		).toBe(true);
		expect(anyShapeChanged([{ id: 'a' }], new Map(), new Map())).toBe(false);
	});
});

describe('error messages', () => {
	const batch = {
		sectorId: 'a',
		sectorName: 'Floor',
		seats: [
			{ label: 'A1', position: { x: 0, y: 0 } },
			{ label: 'A2', position: { x: 1, y: 0 } }
		]
	};

	it('prefers the backend detail for seat batches', () => {
		const message = seatBatchErrorMessage(
			{ detail: "Seat 'A1' position is outside the sector shape." },
			batch,
			'Failed to save'
		);
		expect(message).toBe("Floor: Seat 'A1' position is outside the sector shape.");
	});

	it('falls back to the batch seat labels when no detail is present', () => {
		expect(seatBatchErrorMessage({}, batch, 'Failed to save')).toBe(
			'Floor: Failed to save (A1, A2)'
		);
	});

	it('composes shape update errors the same way', () => {
		const update = { sectorId: 'a', sectorName: 'Floor', shape: null };
		expect(shapeUpdateErrorMessage({ detail: 'Nope' }, update, 'x')).toBe('Floor: Nope');
		expect(shapeUpdateErrorMessage(undefined, update, 'Failed')).toBe('Floor: Failed');
	});
});
