import { describe, it, expect } from 'vitest';
import { homeViewFor, MIN_HOME_CELL_PX, SeatMapViewport } from './seat-map-viewport.svelte';

// The viewport is a plain runes class with no component dependencies, so it
// can be exercised directly: a fake SVG supplies the client rect the pan math
// divides by.

function makeViewport() {
	const svg = {
		getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 300 })
	} as unknown as SVGSVGElement;
	return new SeatMapViewport({
		getSvg: () => svg,
		getContentW: () => 800,
		getContentH: () => 600
	});
}

function pointer(
	type: 'pointerdown' | 'pointermove' | 'pointerup',
	id: number,
	x: number,
	y: number,
	pointerType: 'mouse' | 'touch'
): PointerEvent {
	return { pointerId: id, clientX: x, clientY: y, pointerType } as PointerEvent;
}

function drag(vp: SeatMapViewport, pointerType: 'mouse' | 'touch', dx = 40, dy = 20) {
	vp.onPointerDown(pointer('pointerdown', 1, 100, 100, pointerType));
	vp.onPointerMove(pointer('pointermove', 1, 100 + dx, 100 + dy, pointerType));
	vp.onPointerEnd(pointer('pointerup', 1, 100 + dx, 100 + dy, pointerType));
}

describe('SeatMapViewport', () => {
	it('pans on MOUSE drag at base scale (desktop drag never conflicts with scroll)', () => {
		const vp = makeViewport();
		drag(vp, 'mouse');
		expect(vp.tx).not.toBe(0);
		expect(vp.ty).not.toBe(0);
		expect(vp.suppressClick).toBe(true); // panning must not toggle a seat on release
	});

	it('does NOT pan on TOUCH drag at base scale (the finger scrolls the dialog)', () => {
		const vp = makeViewport();
		drag(vp, 'touch');
		expect(vp.tx).toBe(0);
		expect(vp.ty).toBe(0);
		expect(vp.suppressClick).toBe(false);
	});

	it('pans on TOUCH drag once zoomed in', () => {
		const vp = makeViewport();
		vp.zoomBy(1.5);
		const tx = vp.tx;
		drag(vp, 'touch');
		expect(vp.tx).not.toBe(tx);
	});

	it('yields touch gestures at base scale and captures them when zoomed', () => {
		const vp = makeViewport();
		expect(vp.captureTouch).toBe(false);
		vp.zoomBy(1.5);
		expect(vp.captureTouch).toBe(true);
		vp.resetView();
		expect(vp.captureTouch).toBe(false);
	});

	it('clamps zoom to its bounds', () => {
		const vp = makeViewport();
		for (let i = 0; i < 20; i++) vp.zoomBy(2);
		expect(vp.scale).toBe(5);
		for (let i = 0; i < 40; i++) vp.zoomBy(0.5);
		expect(vp.scale).toBe(0.5);
	});

	it('resetView restores the HOME view, not blindly base scale', () => {
		const vp = makeViewport();
		vp.setHome({ scale: 2, tx: -100, ty: -50 });
		vp.zoomBy(1.5);
		drag(vp, 'mouse');
		vp.resetView();
		expect(vp.scale).toBe(2);
		expect(vp.tx).toBe(-100);
		expect(vp.ty).toBe(-50);
	});
});

describe('homeViewFor', () => {
	const CELL = 32;

	it('fits all at base scale when seats stay readable (the generous default)', () => {
		// Concert-hall-like: 846×433 box, 512×596 viewBox → ~23px cells.
		const view = homeViewFor({
			boxW: 846,
			boxH: 433,
			contentW: 512,
			contentH: 596,
			cell: CELL
		});
		expect(view).toEqual({ scale: 1, tx: 0, ty: 0 });
	});

	it('zooms to the readability floor for a huge chart, centred on the focus sector', () => {
		// 433px box vs 2000-unit-tall content → fit-all cells ≈ 6.9px < 12px.
		const boxW = 846;
		const boxH = 433;
		const contentW = 1600;
		const contentH = 2000;
		const focus = { x: 400, y: 1500 };
		const view = homeViewFor({ boxW, boxH, contentW, contentH, cell: CELL, focus });
		const k = Math.min(boxW / contentW, boxH / contentH);
		expect(view.scale).toBeCloseTo(MIN_HOME_CELL_PX / (CELL * k), 6);
		expect(view.scale).toBeGreaterThan(1);
		// The focus point lands on the canvas centre (which xMidYMid maps to
		// the box centre): focus*scale + t === content/2.
		expect(focus.x * view.scale + view.tx).toBeCloseTo(contentW / 2, 6);
		expect(focus.y * view.scale + view.ty).toBeCloseTo(contentH / 2, 6);
	});

	it('centres on the content middle when zooming without a focus sector', () => {
		const view = homeViewFor({
			boxW: 400,
			boxH: 300,
			contentW: 1600,
			contentH: 2000,
			cell: CELL
		});
		expect(view.scale).toBeGreaterThan(1);
		expect(800 * view.scale + view.tx).toBeCloseTo(800, 6);
		expect(1000 * view.scale + view.ty).toBeCloseTo(1000, 6);
	});

	it('caps the readability zoom at the max zoom bound', () => {
		const view = homeViewFor({
			boxW: 100,
			boxH: 100,
			contentW: 100_000,
			contentH: 100_000,
			cell: CELL
		});
		expect(view.scale).toBe(5);
	});

	it('returns the base view before the box has been measured', () => {
		const view = homeViewFor({ boxW: 0, boxH: 0, contentW: 512, contentH: 596, cell: CELL });
		expect(view).toEqual({ scale: 1, tx: 0, ty: 0 });
	});
});
