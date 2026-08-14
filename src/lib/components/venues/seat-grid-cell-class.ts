/**
 * How one editor cell looks — extracted from SeatGrid.svelte so that file stays
 * inside its length cap, and so the seat language is testable without a DOM.
 *
 * The editor and the buyer's map draw the SAME room (#852): solid round dots on
 * a poster-ink panel, empty slots as ghost outlines, selection as a white offset
 * ring. Colour never carries meaning alone — every state below is also a
 * cursor, a ring, or text in the cell's accessible name.
 *
 * Contrast, measured against the fixed poster values (identical in both modes;
 * `scripts/audit-brand-themes.py` carries the executable rows it can express):
 *   Periwinkle seat on ink        8.36:1   ·  ink label on Periwinkle  8.36:1
 *   white selection ring on ink  17.40:1   ·  amber focus ring on ink   9.42:1
 *   white@10 ghost outline on ink 1.33:1 — see `ghost` below.
 */

/** Everything about a cell that changes how it is drawn. */
export interface CellVisualState {
	/** A seat exists here (an empty cell is a click target, not a seat). */
	hasSeat: boolean;
	/** Committed selection (the bulk-actions bar acts on these). */
	isSelected: boolean;
	/** Inside the live drag-fill rectangle (transient, not yet applied). */
	inRect: boolean;
	/** "Adjust seats" mode is on. */
	adjustActive: boolean;
	/** This seat is the one being dragged. */
	grabbing: boolean;
	/** This seat is the one the adjust inspector is pointed at. */
	picked: boolean;
}

const BASE =
	'absolute flex select-none items-center justify-center rounded-full text-[10px] font-extrabold ' +
	'transition-colors duration-75 focus-visible:outline focus-visible:outline-2 ' +
	'focus-visible:outline-offset-2 focus-visible:outline-poster-amber';

/**
 * An empty slot: a hollow ring, no fill — the lattice reads as "a seat could go
 * here" without competing with the real seats.
 *
 * The resting outline is deliberately faint (white@10 = 1.33:1). It is a HINT,
 * not the control's boundary: an empty cell is identified by the gap it leaves
 * in a lattice of solid seats, it carries a full accessible name, and both the
 * hover state (white@40) and the focus indicator (amber, 9.42:1) are far above
 * the 3:1 floor — which is what a pointer or keyboard user actually navigates
 * by.
 */
const GHOST = 'border border-poster-white/10 text-poster-white/40';

/** White offset ring = "selected", the same cue the buyer's map uses for held seats. */
const SELECTED_RING = 'outline outline-2 outline-offset-2 outline-poster-white';
/** Dashed = "about to be selected" (live rectangle), so it never reads as committed. */
const RECT_RING = 'outline outline-2 outline-dashed outline-offset-2 outline-poster-white/70';

export function seatCellClass(state: CellVisualState): string {
	const { hasSeat, isSelected, inRect, adjustActive, grabbing, picked } = state;

	if (adjustActive) {
		// Empty cells are inert in this mode (nothing to select or drag), so they
		// step out of the way entirely: no pointer target — which is what lets a
		// click on free canvas reach the add-anywhere layer — and, paired with
		// `disabled` on the button, no tab stop either.
		if (!hasSeat) return `${BASE} ${GHOST} pointer-events-none border-dashed`;
		return [
			BASE,
			'z-10 touch-none',
			grabbing ? 'z-30 cursor-grabbing opacity-90' : 'cursor-grab',
			picked ? `z-30 ${SELECTED_RING}` : ''
		]
			.filter(Boolean)
			.join(' ');
	}

	if (isSelected) return `${BASE} z-20 ${SELECTED_RING}`;

	// The rectangle keeps each cell's own fill (you see what you are about to
	// paint or fill); only the ring says "this one is in the sweep".
	if (inRect) {
		return `${BASE} z-20 ${RECT_RING} ${hasSeat ? '' : `${GHOST} bg-poster-white/20`}`;
	}

	if (hasSeat) return `${BASE} z-10 cursor-pointer`;

	return `${BASE} ${GHOST} cursor-pointer hover:border-poster-white/40 hover:bg-poster-white/10`;
}
