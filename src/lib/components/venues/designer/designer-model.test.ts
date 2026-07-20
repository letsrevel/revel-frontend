import { describe, it, expect } from 'vitest';
import type { VenueSectorWithSeatsSchema } from '$lib/api/generated/types.gen';
import {
	blockLocalCenter,
	blockWorldBounds,
	blocksWorldBounds,
	buildDesignerModel,
	parseStage,
	type DesignerBlock,
	type DesignerModel
} from './designer-model';

/** Look up a block by id, asserting it exists (avoids non-null assertions). */
function blockOf(model: DesignerModel, id: string): DesignerBlock {
	const block = model.blocks.find((b) => b.id === id);
	if (!block) throw new Error(`missing block ${id}`);
	return block;
}

function positioned(): VenueSectorWithSeatsSchema {
	return {
		id: 'a',
		name: 'Orchestra',
		kind: 'seated',
		display_order: 0,
		metadata: { aisles: { verticalAisles: [2], horizontalAisles: [], invertRowOrder: false } },
		shape: [
			{ x: 10, y: 10 },
			{ x: 14, y: 10 },
			{ x: 14, y: 12 },
			{ x: 10, y: 12 }
		],
		seats: [
			{ label: 'A1', position: { x: 10, y: 10 }, is_active: true, id: 's1' },
			{ label: 'A2', position: { x: 11, y: 10 }, is_active: true, id: 's2' }
		]
	};
}

function arranged(): VenueSectorWithSeatsSchema {
	return {
		id: 'b',
		name: 'Balcony',
		kind: 'seated',
		display_order: 1,
		metadata: { transform: { x: 5, y: 3, rotation: 90 }, aisles: { verticalAisles: [] } },
		shape: null,
		seats: [{ label: 'B1', position: { x: 0, y: 0 }, is_active: true, id: 'b1' }]
	};
}

describe('buildDesignerModel', () => {
	it('normalizes seats/shape to a local frame and records the persist offset', () => {
		const model = buildDesignerModel([positioned()], null);
		const block = blockOf(model, 'a');
		expect(block.name).toBe('Orchestra');
		expect(block.hasCompletePositions).toBe(true);
		// Shared min over seats ∪ shape is (10, 10).
		expect(block.shapeFrameOffset).toEqual({ x: 10, y: 10 });
		expect(block.seats.map((s) => ({ x: s.x, y: s.y }))).toEqual([
			{ x: 0, y: 0 },
			{ x: 1, y: 0 }
		]);
		expect(block.shape).toEqual([
			{ x: 0, y: 0 },
			{ x: 4, y: 0 },
			{ x: 4, y: 2 },
			{ x: 0, y: 2 }
		]);
		// Existing metadata (aisles) is preserved for save-time merging.
		expect(block.metadata).toMatchObject({ aisles: { verticalAisles: [2] } });
	});

	it('reads a stored transform from sector metadata verbatim', () => {
		const model = buildDesignerModel([arranged()], null);
		const block = blockOf(model, 'b');
		expect(block.transform).toEqual({ x: 5, y: 3, rotation: 90 });
	});

	it('defaults the stage above the blocks when the venue has none', () => {
		const model = buildDesignerModel([positioned()], null);
		const blocksBounds = blocksWorldBounds(model.blocks, (id) => blockOf(model, id).transform);
		expect(model.stage.position.y).toBeLessThan(blocksBounds.minY);
		expect(model.stage.shape).toHaveLength(4);
	});

	it('reads a stored stage from venue metadata', () => {
		const model = buildDesignerModel([positioned()], {
			stage: {
				position: { x: 2, y: -5 },
				shape: [
					{ x: -3, y: -1 },
					{ x: 3, y: -1 },
					{ x: 0, y: 1 }
				],
				label: 'Main stage'
			}
		});
		expect(model.stage.position).toEqual({ x: 2, y: -5 });
		expect(model.stage.shape).toHaveLength(3);
		expect(model.stage.label).toBe('Main stage');
		expect(model.venueMetadata).not.toBeNull();
	});
});

describe('parseStage', () => {
	it('returns null when absent or malformed', () => {
		expect(parseStage(null)).toBeNull();
		expect(parseStage({})).toBeNull();
		expect(parseStage({ stage: { position: { x: 'nope', y: 1 } } })).toBeNull();
		expect(parseStage({ stage: { position: { x: 1, y: NaN } } })).toBeNull();
	});

	it('drops a shape with fewer than 3 vertices', () => {
		const stage = parseStage({
			stage: {
				position: { x: 0, y: 0 },
				shape: [
					{ x: 0, y: 0 },
					{ x: 1, y: 1 }
				]
			}
		});
		expect(stage?.shape).toBeNull();
	});
});

describe('blockWorldBounds', () => {
	it('accounts for rotation', () => {
		const block = { width: 2, height: 4 } as Pick<DesignerBlock, 'width' | 'height'>;
		const bounds = blockWorldBounds(block, { x: 0, y: 0, rotation: 90 });
		// A 2×4 block rotated 90° clockwise spans x∈[-4,0], y∈[0,2].
		expect(bounds.minX).toBeCloseTo(-4);
		expect(bounds.maxX).toBeCloseTo(0);
		expect(bounds.minY).toBeCloseTo(0);
		expect(bounds.maxY).toBeCloseTo(2);
	});

	it('blockLocalCenter is the local mid-point', () => {
		expect(blockLocalCenter({ width: 6, height: 4 })).toEqual({ x: 3, y: 2 });
	});
});
