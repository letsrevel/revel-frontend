import { describe, it, expect } from 'vitest';
import { SeatMapViewport } from './seat-map-viewport.svelte';

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
});
