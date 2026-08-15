/**
 * The seat visual language, in one place.
 *
 * Both seat surfaces — the buyer's map (`SeatMap.svelte`) and the sector editor
 * (`venues/SeatGrid.svelte`) — draw the SAME room: solid round dots on a
 * mode-inert poster-ink panel, exactly like the landing page's
 * `landing/poster/SeatMapMock.svelte`. This module owns the two decisions that
 * must not drift between them:
 *
 *   · what colour a seat's body is (organizer's price-category colour when the
 *     seat is painted, poster Periwinkle when it isn't), and
 *   · what colour a glyph drawn ON that body must be to stay readable
 *     (`paintTextColor` picks black/white by the fill's own luminance).
 *
 * Category colours are USER DATA and stay inline `fill`/`background-color`
 * values — they are the one legitimate exception to the raw-hue sweep rule.
 * Everything else here resolves to a `--poster-*` token.
 *
 * Hand-verified ratios (poster values are fixed and identical in both modes, so
 * `scripts/audit-brand-themes.py` sees a decorative panel, not a theme surface;
 * the composited rows it CAN execute are registered in its COMPOSITED_PAIRS):
 *   Periwinkle on ink        8.36:1  (an unpainted seat against the house)
 *   ink on Periwinkle        8.36:1  (its label/glyph)
 *   white on ink            17.40:1  (the selection ring)
 *   white@25 on ink          2.26:1  (an unavailable seat — see below)
 *   white@25 vs Periwinkle   3.70:1  (available vs unavailable: the pair that
 *                                     actually carries the meaning, ≥3:1)
 *
 * The dim fill is deliberately faint. What a buyer must be able to tell apart
 * is an available seat from an unavailable one, and THAT pair is 3.70:1; the
 * dim dot's own edge against the panel is not information (a seat they cannot
 * buy is not a target). The reason a seat is unavailable — sold, held, blocked
 * — is never colour-only: it is in the seat's accessible name and its hover
 * title, and the legend restates every state in words.
 */
import { paintTextColor } from '$lib/components/venues/seat-grid-save';

/** Seat body when the organizer painted no price category on it. */
export const SEAT_DEFAULT_FILL = 'hsl(var(--poster-periwinkle))';
/** Readable glyph/label colour on {@link SEAT_DEFAULT_FILL} (8.36:1). */
export const SEAT_DEFAULT_INK = 'hsl(var(--poster-ink))';

/** A seat's body colour: its price-category colour, else poster Periwinkle. */
export function seatFill(categoryColor?: string | null): string {
	return categoryColor || SEAT_DEFAULT_FILL;
}

/**
 * Colour for a glyph drawn on a seat body (the "mine" check, the editor's seat
 * label, the rotation notch): black or white on a painted seat, poster ink on
 * the Periwinkle default — ink rather than pure black so an unpainted seat is
 * the same two poster values everywhere.
 */
export function seatGlyphColor(categoryColor?: string | null): string {
	if (!categoryColor) return SEAT_DEFAULT_INK;
	return paintTextColor(categoryColor);
}
