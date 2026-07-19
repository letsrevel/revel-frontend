import { describe, it, expect } from 'vitest';
import type { Coordinate2d } from '$lib/api/generated/types.gen';
import type { SectorTransform } from '$lib/components/tickets/sector-transform';
import type { DesignerBlock, DesignerModel, StageModel } from './designer-model';
import {
	buildSavePlan,
	mergeStageIntoMetadata,
	mergeTransformIntoMetadata,
	sectorUpdateErrorMessage,
	serializeStage,
	stagesEqual,
	transformsEqual,
	type SavePlanInput
} from './designer-save';

function block(id: string, overrides: Partial<DesignerBlock> = {}): DesignerBlock {
	return {
		id,
		name: `Sector ${id}`,
		kind: 'seated',
		seats: [],
		shape: null,
		width: 4,
		height: 4,
		transform: { x: 0, y: 0, rotation: 0 },
		shapeFrameOffset: { x: 0, y: 0 },
		metadata: null,
		hasSeats: true,
		hasCompletePositions: false,
		...overrides
	};
}

const stage = (overrides: Partial<StageModel> = {}): StageModel => ({
	position: { x: 0, y: 0 },
	shape: null,
	...overrides
});

function makeInput(model: DesignerModel, overrides: Partial<SavePlanInput> = {}): SavePlanInput {
	const transforms = new Map(model.blocks.map((b) => [b.id, b.transform]));
	const shapes = new Map(model.blocks.map((b) => [b.id, b.shape]));
	return {
		model,
		transforms,
		baselineTransforms: new Map(transforms),
		shapes,
		baselineShapes: new Map(shapes),
		stage: model.stage,
		baselineStage: model.stage,
		...overrides
	};
}

describe('transformsEqual / stagesEqual', () => {
	it('are epsilon-tolerant', () => {
		expect(transformsEqual({ x: 1, y: 1, rotation: 0 }, { x: 1, y: 1.0001, rotation: 0 })).toBe(
			true
		);
		expect(transformsEqual({ x: 1, y: 1, rotation: 0 }, { x: 1, y: 1, rotation: 15 })).toBe(false);
		expect(stagesEqual(stage(), stage())).toBe(true);
		expect(stagesEqual(stage(), stage({ position: { x: 2, y: 0 } }))).toBe(false);
	});
});

describe('metadata merges', () => {
	it('preserves existing keys when merging a transform', () => {
		const merged = mergeTransformIntoMetadata(
			{ aisles: { verticalAisles: [1] } },
			{
				x: 2,
				y: 3,
				rotation: 45
			}
		);
		expect(merged).toEqual({
			aisles: { verticalAisles: [1] },
			transform: { x: 2, y: 3, rotation: 45 }
		});
	});

	it('preserves existing venue keys when merging a stage', () => {
		const merged = mergeStageIntoMetadata({ other: true }, stage({ position: { x: 1, y: 2 } }));
		expect(merged).toEqual({ other: true, stage: { position: { x: 1, y: 2 }, shape: null } });
	});

	it('serializeStage rounds and includes the label', () => {
		const s = serializeStage(stage({ position: { x: 1.00004, y: 2 }, label: 'Main' }));
		expect(s).toEqual({ position: { x: 1, y: 2 }, shape: null, label: 'Main' });
	});
});

describe('buildSavePlan', () => {
	const model = (): DesignerModel => ({
		blocks: [block('a', { transform: { x: 0, y: 10, rotation: 0 } })],
		stage: stage(),
		venueMetadata: null
	});

	it('is empty when nothing changed', () => {
		const plan = buildSavePlan(makeInput(model()));
		expect(plan.isEmpty).toBe(true);
	});

	it('emits merged metadata for a moved sector, preserving aisles', () => {
		const m = model();
		m.blocks[0].metadata = { aisles: { verticalAisles: [2] } };
		const transforms = new Map<string, SectorTransform>([['a', { x: 3, y: 12, rotation: 30 }]]);
		const plan = buildSavePlan(
			makeInput(m, { transforms, baselineTransforms: new Map([['a', m.blocks[0].transform]]) })
		);
		expect(plan.sectorUpdates).toHaveLength(1);
		expect(plan.sectorUpdates[0].metadata).toEqual({
			aisles: { verticalAisles: [2] },
			transform: { x: 3, y: 12, rotation: 30 }
		});
		expect(plan.sectorUpdates[0].shape).toBeUndefined();
	});

	it('maps an edited outline back into the persist frame', () => {
		const m: DesignerModel = {
			blocks: [block('a', { shapeFrameOffset: { x: 1, y: 1 } })],
			stage: stage(),
			venueMetadata: null
		};
		const triangle: Coordinate2d[] = [
			{ x: 0, y: 0 },
			{ x: 3, y: 0 },
			{ x: 0, y: 3 }
		];
		const plan = buildSavePlan(
			makeInput(m, {
				shapes: new Map([['a', triangle]]),
				baselineShapes: new Map([['a', null]])
			})
		);
		expect(plan.sectorUpdates[0].shape).toEqual([
			{ x: 1, y: 1 },
			{ x: 4, y: 1 },
			{ x: 1, y: 4 }
		]);
		expect(plan.sectorUpdates[0].metadata).toBeUndefined();
	});

	it('flags an outline with fewer than 3 points and withholds the sector', () => {
		const m = model();
		const plan = buildSavePlan(
			makeInput(m, {
				shapes: new Map([
					[
						'a',
						[
							{ x: 0, y: 0 },
							{ x: 1, y: 1 }
						]
					]
				]),
				baselineShapes: new Map([['a', null]])
			})
		);
		expect(plan.invalidShapeSectors).toEqual([{ sectorId: 'a', sectorName: 'Sector a' }]);
		expect(plan.sectorUpdates).toEqual([]);
		expect(plan.isEmpty).toBe(false);
	});

	it('reports seats stranded by a changed outline (only for complete-position sectors)', () => {
		const seated = block('a', {
			hasCompletePositions: true,
			seats: [
				{ id: 's1', label: 'A1', x: 1, y: 1 },
				{ id: 's2', label: 'A2', x: 9, y: 9 }
			]
		});
		const m: DesignerModel = { blocks: [seated], stage: stage(), venueMetadata: null };
		const triangle: Coordinate2d[] = [
			{ x: 0, y: 0 },
			{ x: 3, y: 0 },
			{ x: 0, y: 3 }
		];
		const plan = buildSavePlan(
			makeInput(m, {
				shapes: new Map([['a', triangle]]),
				baselineShapes: new Map([['a', null]])
			})
		);
		expect(plan.violations).toEqual([
			{ sectorId: 'a', sectorName: 'Sector a', seatLabels: ['A2'] }
		]);
		expect(plan.sectorUpdates).toEqual([]);
	});

	it('skips the containment guard for grid-only sectors', () => {
		const grid = block('a', {
			hasCompletePositions: false,
			seats: [{ id: 's1', label: 'A1', x: 9, y: 9 }]
		});
		const m: DesignerModel = { blocks: [grid], stage: stage(), venueMetadata: null };
		const triangle: Coordinate2d[] = [
			{ x: 0, y: 0 },
			{ x: 3, y: 0 },
			{ x: 0, y: 3 }
		];
		const plan = buildSavePlan(
			makeInput(m, {
				shapes: new Map([['a', triangle]]),
				baselineShapes: new Map([['a', null]])
			})
		);
		expect(plan.violations).toEqual([]);
		expect(plan.sectorUpdates).toHaveLength(1);
	});

	it('emits a stage venue update merged with existing venue metadata', () => {
		const m: DesignerModel = {
			blocks: [],
			stage: stage(),
			venueMetadata: { capacityNote: 'x' }
		};
		const moved = stage({ position: { x: 4, y: -8 } });
		const plan = buildSavePlan(makeInput(m, { stage: moved, baselineStage: m.stage }));
		expect(plan.stageUpdate).toEqual({
			metadata: { capacityNote: 'x', stage: { position: { x: 4, y: -8 }, shape: null } }
		});
		expect(plan.isEmpty).toBe(false);
	});
});

describe('error message helpers', () => {
	it('prefers backend detail', () => {
		expect(
			sectorUpdateErrorMessage({ detail: 'Bad shape' }, { sectorName: 'Floor' }, 'Failed')
		).toBe('Floor: Bad shape');
		expect(sectorUpdateErrorMessage({}, { sectorName: 'Floor' }, 'Failed')).toBe('Floor: Failed');
	});
});
