/**
 * Deterministic cover-art fallback gradients for events, series and
 * organizations.
 *
 * These are IMAGERY, not surfaces: they stand in for a missing cover photo, so
 * they keep the fixed poster palette in both light and dark mode (the same rule
 * the landing panels and `brand/Sticker` follow). That is also why they are not
 * theme tokens — a cover that flipped lightness with the theme would look like a
 * different picture rather than the same picture on a different page.
 *
 * Every pair below is dark enough at BOTH stops to carry the white overlay art
 * (logo watermark, fallback icon) the call sites paint on top; where real text
 * sits over one (the event hero) the call site adds an ink scrim and states its
 * measured ratio.
 *
 * Returned value is the color-stop pair only — call sites supply the direction
 * utility (`bg-gradient-to-br`), so a caller can pick its own axis.
 */
export const POSTER_FALLBACK_GRADIENTS = [
	'from-poster-purple to-poster-crimson-deep',
	'from-poster-ink to-poster-purple',
	'from-poster-crimson-deep to-poster-purple',
	'from-poster-purple to-poster-lavender',
	'from-poster-ink to-poster-crimson-deep',
	'from-poster-lavender to-poster-crimson-deep'
] as const;

/**
 * Pick a stable gradient for an entity id. Same id ⇒ same gradient, forever —
 * a cover that reshuffled between renders would read as a loading glitch.
 */
export function getPosterFallbackGradient(seed: string): string {
	const hash = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
	return POSTER_FALLBACK_GRADIENTS[Math.abs(hash) % POSTER_FALLBACK_GRADIENTS.length];
}
