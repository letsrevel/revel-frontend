/**
 * Pan/zoom state for the designer canvas, following SeatMap.svelte's idiom:
 * the SVG viewBox stays fixed at the content size and an inner <g> carries a
 * translate/scale transform. Wheel zoom needs a non-passive listener (Svelte's
 * onwheel is passive), attached via the `wheel` action.
 */
import type { Coordinate2d } from '$lib/api/generated/types.gen';

export interface ViewportOptions {
	/** Left padding of the drawable area, in px. */
	pad: number;
	/** Top offset of the drawable area (padding + stage strip), in px. */
	offsetY: number;
	/** Pixels per layout unit. */
	cell: number;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 5;

export class DesignerViewport {
	scale = $state(1);
	tx = $state(0);
	ty = $state(0);
	svgEl: SVGSVGElement | undefined;

	constructor(
		private readonly opts: ViewportOptions,
		/** Current content size in px (the SVG viewBox dimensions). */
		private readonly content: () => { w: number; h: number }
	) {}

	zoomAt(px: number, py: number, factor: number): void {
		const next = Math.min(Math.max(this.scale * factor, MIN_SCALE), MAX_SCALE);
		const k = next / this.scale;
		this.tx = px - (px - this.tx) * k;
		this.ty = py - (py - this.ty) * k;
		this.scale = next;
	}

	zoomBy(factor: number): void {
		const { w, h } = this.content();
		this.zoomAt(w / 2, h / 2, factor);
	}

	reset(): void {
		this.scale = 1;
		this.tx = 0;
		this.ty = 0;
	}

	/** Client (px) → viewBox coordinates; null when the SVG has no box yet. */
	clientToView(clientX: number, clientY: number): Coordinate2d | null {
		const rect = this.svgEl?.getBoundingClientRect();
		if (!rect || rect.width === 0 || rect.height === 0) return null;
		const { w, h } = this.content();
		return {
			x: ((clientX - rect.left) / rect.width) * w,
			y: ((clientY - rect.top) / rect.height) * h
		};
	}

	/** Client (px) → layout-unit coordinates (through the pan/zoom transform). */
	clientToUnit(clientX: number, clientY: number): Coordinate2d | null {
		const view = this.clientToView(clientX, clientY);
		if (!view) return null;
		return {
			x: ((view.x - this.tx) / this.scale - this.opts.pad) / this.opts.cell,
			y: ((view.y - this.ty) / this.scale - this.opts.offsetY) / this.opts.cell
		};
	}

	/** Pan by a client-pixel delta (converted through the viewBox scale). */
	panByClientDelta(dxClient: number, dyClient: number): void {
		const rect = this.svgEl?.getBoundingClientRect();
		if (!rect || rect.width === 0 || rect.height === 0) return;
		const { w, h } = this.content();
		this.tx += (dxClient / rect.width) * w;
		this.ty += (dyClient / rect.height) * h;
	}

	/** Svelte action: non-passive wheel-zoom listener on the SVG element. */
	wheel = (node: SVGSVGElement): { destroy: () => void } => {
		const onWheel = (event: WheelEvent) => {
			event.preventDefault();
			const point = this.clientToView(event.clientX, event.clientY);
			const factor = Math.pow(1.0015, -event.deltaY);
			if (point) {
				this.zoomAt(point.x, point.y, factor);
			} else {
				this.zoomBy(factor);
			}
		};
		node.addEventListener('wheel', onWheel, { passive: false });
		return {
			destroy: () => node.removeEventListener('wheel', onWheel)
		};
	};
}
