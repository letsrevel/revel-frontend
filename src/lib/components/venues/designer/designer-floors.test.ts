import { describe, it, expect } from 'vitest';
import type { DesignerBlock, DesignerModel } from './designer-model';
import { DesignerFloorState } from './designer-floors.svelte';
import type { VenueFloor } from '../venue-floors';

const ground: VenueFloor = { id: 'g', name: 'Ground floor', order: 0 };
const upper: VenueFloor = { id: 'u', name: 'Upper floor', order: 1 };

function block(id: string, floorId: string | null = null): DesignerBlock {
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
		floorId,
		hasSeats: true,
		hasCompletePositions: false
	};
}

function model(blocks: DesignerBlock[], floors: VenueFloor[]): DesignerModel {
	return {
		blocks,
		stage: { position: { x: 0, y: 0 }, shape: null },
		venueMetadata: null,
		floors
	};
}

describe('DesignerFloorState', () => {
	it('flattened venue: every block visible, stage visible, not dirty', () => {
		const state = new DesignerFloorState(model([block('a'), block('b')], []));
		expect(state.hasFloors).toBe(false);
		expect(state.isVisible('a')).toBe(true);
		expect(state.stageVisible).toBe(true);
		expect(state.dirty).toBe(false);
	});

	it('unassigned blocks live on the FIRST floor; explicit ones on theirs', () => {
		const state = new DesignerFloorState(model([block('a'), block('b', 'u')], [ground, upper]));
		expect(state.activeFloorId).toBe('g');
		expect(state.effectiveFloorOf('a')).toBe('g');
		expect(state.effectiveFloorOf('b')).toBe('u');
		expect(state.isVisible('a')).toBe(true);
		expect(state.isVisible('b')).toBe(false);
		state.activeFloorId = 'u';
		expect(state.isVisible('a')).toBe(false);
		expect(state.isVisible('b')).toBe(true);
	});

	it('stage renders on the first floor only (convention: no floor field)', () => {
		const state = new DesignerFloorState(model([], [ground, upper]));
		expect(state.stageVisible).toBe(true);
		state.activeFloorId = 'u';
		expect(state.stageVisible).toBe(false);
	});

	it('moveBlockToFloor makes the assignment explicit and marks dirty', () => {
		const state = new DesignerFloorState(model([block('a')], [ground, upper]));
		expect(state.dirty).toBe(false);
		state.moveBlockToFloor('a', 'u');
		expect(state.effectiveFloorOf('a')).toBe('u');
		expect(state.dirty).toBe(true);
		state.commitBaseline();
		expect(state.dirty).toBe(false);
	});

	it('addFloor appends after the last order and activates the new floor', () => {
		const state = new DesignerFloorState(model([], []));
		const first = state.addFloor('Floor 1');
		expect(first.order).toBe(0);
		expect(state.activeFloorId).toBe(first.id);
		const second = state.addFloor('Floor 2');
		expect(second.order).toBe(1);
		expect(state.activeFloorId).toBe(second.id);
		expect(state.dirty).toBe(true);
	});

	it('moveFloor swaps neighbors and normalizes orders 0..n-1', () => {
		const state = new DesignerFloorState(model([], [ground, upper]));
		state.moveFloor('u', -1);
		expect(state.floors.map((floor) => floor.id)).toEqual(['u', 'g']);
		expect(state.floors.map((floor) => floor.order)).toEqual([0, 1]);
		// Ends are clamped.
		state.moveFloor('u', -1);
		expect(state.floors.map((floor) => floor.id)).toEqual(['u', 'g']);
	});

	it('reordering moves implicit blocks with the FIRST floor (buyer-consistent)', () => {
		const state = new DesignerFloorState(model([block('a')], [ground, upper]));
		expect(state.effectiveFloorOf('a')).toBe('g');
		state.moveFloor('u', -1);
		expect(state.effectiveFloorOf('a')).toBe('u');
	});

	it('deleteFloor is refused while the floor has sectors — even implicit ones', () => {
		const state = new DesignerFloorState(model([block('a'), block('b', 'u')], [ground, upper]));
		expect(state.sectorNamesOn('g')).toEqual(['Sector a']);
		expect(state.deleteFloor('g')).toBe(false);
		expect(state.deleteFloor('u')).toBe(false);
		expect(state.floors).toHaveLength(2);
		// Empty the upper floor, then delete it.
		state.moveBlockToFloor('b', 'g');
		expect(state.deleteFloor('u')).toBe(true);
		expect(state.floors.map((floor) => floor.id)).toEqual(['g']);
	});

	it('deleting the active floor falls back to the first floor', () => {
		const state = new DesignerFloorState(model([], [ground, upper]));
		state.activeFloorId = 'u';
		expect(state.deleteFloor('u')).toBe(true);
		expect(state.activeFloorId).toBe('g');
	});

	it('renameFloor trims and ignores empty names', () => {
		const state = new DesignerFloorState(model([], [ground]));
		state.renameFloor('g', '  Parterre  ');
		expect(state.floors[0].name).toBe('Parterre');
		state.renameFloor('g', '   ');
		expect(state.floors[0].name).toBe('Parterre');
	});

	it('saveInput mirrors the current and baseline floor state', () => {
		const state = new DesignerFloorState(model([block('a')], [ground, upper]));
		state.moveBlockToFloor('a', 'u');
		state.renameFloor('g', 'Parterre');
		const input = state.saveInput;
		expect(input.floors[0].name).toBe('Parterre');
		expect(input.baselineFloors[0].name).toBe('Ground floor');
		expect(input.floorIds.get('a')).toBe('u');
		expect(input.baselineFloorIds.get('a')).toBeNull();
	});
});
