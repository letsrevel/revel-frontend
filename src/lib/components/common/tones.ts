/**
 * Semantic tone vocabulary for the rebrand primitives (StatusBadge, ToneTile,
 * EmptyState). Tones map to theme tokens, never to raw Tailwind palette hues —
 * this is what replaces the app's scattered bg-blue-50/text-emerald-600 pattern.
 */
export type Tone = 'brand' | 'info' | 'success' | 'warning' | 'danger' | 'neutral';

/**
 * Fixed poster-palette identity axis for `ToneTile`'s `tint` prop. Unlike
 * `Tone`, this carries no semantic meaning — it's for destination/identity
 * coloring (e.g. the admin quick-actions grid) and is mode-inert by design
 * (imagery rule: same tint in light and dark).
 */
export type PosterTint =
	'purple' | 'lavender' | 'periwinkle' | 'amber' | 'crimson' | 'ink' | 'paper';
