/**
 * Rune-based pan/zoom viewport for the buyer SeatMap (mirrors the designer's
 * designer-viewport.svelte.ts split: interaction state out of the component).
 *
 * Cooperative by design — the map lives inside a scrollable dialog and must
 * never trap the page:
 *
 * - A BARE wheel is a scroll and passes through to the dialog; only
 *   Ctrl/Cmd+wheel zooms — which is also exactly how trackpad pinch arrives
 *   (ctrlKey wheel events), so pinch keeps zooming natively. A bare wheel
 *   surfaces a transient hint teaching the chord.
 * - At base scale the whole map fits its box (viewBox meet): panning is
 *   pointless, so touch-action stays pan-y and a finger on the map scrolls
 *   the DIALOG. Once zoomed in (buttons or pinch) the map captures gestures
 *   for real pan/pinch; reset hands scrolling back.
 * - A drag beyond a small threshold suppresses the click that fires on
 *   release, so panning over a seat never toggles it.
 */
import { SvelteMap } from 'svelte/reactivity';

const MIN_SCALE = 0.5;
const MAX_SCALE = 5;
const WHEEL_HINT_MS = 1600;

/** Readability floor for the DEFAULT view: a seat cell rendered smaller than
    this many px is unreadable, so the home view zooms past fit-all instead.
    Deliberately small — fitting the whole chart in frame is strongly
    preferred; only genuinely huge venues overflow and need panning. */
export const MIN_HOME_CELL_PX = 12;

export interface SeatMapViewTransform {
	scale: number;
	tx: number;
	ty: number;
}

const BASE_VIEW: SeatMapViewTransform = { scale: 1, tx: 0, ty: 0 };

/**
 * Default ("home") view for a freshly rendered map: fit-all at base scale —
 * the svg letterboxes its whole viewBox into the box (`meet`) — unless that
 * would render seat cells below `minCellPx`. Then zoom just enough to hit the
 * floor, centred on `focus` (the sector the buyer is here to buy, in canvas
 * coordinates), accepting overflow + panning.
 */
export function homeViewFor(args: {
	/** Rendered CSS box of the map (px). */
	boxW: number;
	boxH: number;
	/** viewBox dimensions (canvas units). */
	contentW: number;
	contentH: number;
	/** Canvas units per seat cell (SeatMap's CELL). */
	cell: number;
	minCellPx?: number;
	/** Canvas-space point to centre when zooming past fit-all. */
	focus?: { x: number; y: number } | null;
}): SeatMapViewTransform {
	const { boxW, boxH, contentW, contentH, cell, minCellPx = MIN_HOME_CELL_PX, focus = null } = args;
	if (boxW <= 0 || boxH <= 0 || contentW <= 0 || contentH <= 0 || cell <= 0) {
		return BASE_VIEW;
	}
	// px per canvas unit once `meet` letterboxes the viewBox into the box.
	const k = Math.min(boxW / contentW, boxH / contentH);
	const renderedCell = cell * k;
	if (renderedCell >= minCellPx) return BASE_VIEW;
	const scale = Math.min(minCellPx / renderedCell, MAX_SCALE);
	const cx = focus?.x ?? contentW / 2;
	const cy = focus?.y ?? contentH / 2;
	// Centre the focus point: canvas centre maps to the box centre (xMidYMid).
	return { scale, tx: contentW / 2 - cx * scale, ty: contentH / 2 - cy * scale };
}

export interface SeatMapViewportOptions {
	getSvg: () => SVGSVGElement | undefined;
	getContentW: () => number;
	getContentH: () => number;
}

export class SeatMapViewport {
	scale = $state(1);
	tx = $state(0);
	ty = $state(0);
	/** Transient "hold Ctrl to zoom" hint (bare wheel rolled over the map). */
	showWheelHint = $state(false);

	/** Set once a drag/pinch moved far enough that the release-click must be ignored. */
	suppressClick = false;

	/** The default view resetView returns to — fit-all, or the readability
	    zoom homeViewFor computed for an oversized chart. */
	home: SeatMapViewTransform = { scale: 1, tx: 0, ty: 0 };

	#opts: SeatMapViewportOptions;
	#pointers = new SvelteMap<number, { x: number; y: number }>();
	#hintTimer: ReturnType<typeof setTimeout> | undefined;

	constructor(opts: SeatMapViewportOptions) {
		this.#opts = opts;
	}

	/** Whether the map should own touch gestures (zoomed in) or yield to scroll. */
	get captureTouch(): boolean {
		return this.scale > 1;
	}

	zoomAt(px: number, py: number, factor: number): void {
		const next = Math.min(Math.max(this.scale * factor, MIN_SCALE), MAX_SCALE);
		const k = next / this.scale;
		this.tx = px - (px - this.tx) * k;
		this.ty = py - (py - this.ty) * k;
		this.scale = next;
	}

	zoomBy = (factor: number): void => {
		this.zoomAt(this.#opts.getContentW() / 2, this.#opts.getContentH() / 2, factor);
	};

	/** Replace the home view (does not move the current view). */
	setHome(view: SeatMapViewTransform): void {
		this.home = view;
	}

	resetView = (): void => {
		this.scale = this.home.scale;
		this.tx = this.home.tx;
		this.ty = this.home.ty;
	};

	#clientToView(clientX: number, clientY: number): { x: number; y: number } | null {
		const rect = this.#opts.getSvg()?.getBoundingClientRect();
		if (!rect || rect.width === 0 || rect.height === 0) return null;
		return {
			x: ((clientX - rect.left) / rect.width) * this.#opts.getContentW(),
			y: ((clientY - rect.top) / rect.height) * this.#opts.getContentH()
		};
	}

	/** Svelte action: cooperative wheel zoom (needs a non-passive listener). */
	wheelZoom = (node: SVGSVGElement) => {
		const onWheel = (event: WheelEvent) => {
			if (!event.ctrlKey && !event.metaKey) {
				this.showWheelHint = true;
				clearTimeout(this.#hintTimer);
				this.#hintTimer = setTimeout(() => (this.showWheelHint = false), WHEEL_HINT_MS);
				return; // let the dialog scroll
			}
			event.preventDefault();
			this.showWheelHint = false;
			const point = this.#clientToView(event.clientX, event.clientY);
			const factor = Math.pow(1.0015, -event.deltaY);
			if (point) {
				this.zoomAt(point.x, point.y, factor);
			} else {
				this.zoomBy(factor);
			}
		};
		node.addEventListener('wheel', onWheel, { passive: false });
		return {
			destroy: () => {
				node.removeEventListener('wheel', onWheel);
				clearTimeout(this.#hintTimer);
			}
		};
	};

	onPointerDown = (event: PointerEvent): void => {
		this.#pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		if (this.#pointers.size === 1) this.suppressClick = false;
	};

	onPointerMove = (event: PointerEvent): void => {
		const prev = this.#pointers.get(event.pointerId);
		if (!prev) return;
		const current = { x: event.clientX, y: event.clientY };
		if (this.#pointers.size === 1) {
			// A MOUSE drag pans at any scale (dragging never conflicts with
			// desktop scrolling — the wheel owns that). TOUCH pans only once
			// zoomed in: at base scale the map fits the box, so the finger's
			// drag belongs to the dialog scroll under touch-action: pan-y, and
			// swallowing it here would fight the browser. Keep tracking the
			// pointer either way so a pinch starting later has fresh anchors.
			if (this.scale > 1 || event.pointerType === 'mouse') {
				const rect = this.#opts.getSvg()?.getBoundingClientRect();
				if (rect && rect.width > 0 && rect.height > 0) {
					this.tx += ((current.x - prev.x) / rect.width) * this.#opts.getContentW();
					this.ty += ((current.y - prev.y) / rect.height) * this.#opts.getContentH();
				}
				if (Math.abs(current.x - prev.x) + Math.abs(current.y - prev.y) > 2) {
					this.suppressClick = true;
				}
			}
		} else if (this.#pointers.size === 2) {
			const other = [...this.#pointers.entries()].find(([id]) => id !== event.pointerId)?.[1];
			if (other) {
				const prevDist = Math.hypot(prev.x - other.x, prev.y - other.y);
				const nextDist = Math.hypot(current.x - other.x, current.y - other.y);
				if (prevDist > 0) {
					const mid = this.#clientToView((current.x + other.x) / 2, (current.y + other.y) / 2);
					if (mid) this.zoomAt(mid.x, mid.y, nextDist / prevDist);
				}
				this.suppressClick = true;
			}
		}
		this.#pointers.set(event.pointerId, current);
	};

	onPointerEnd = (event: PointerEvent): void => {
		this.#pointers.delete(event.pointerId);
	};
}
