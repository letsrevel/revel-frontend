/**
 * Semantic tone vocabulary for the rebrand primitives (StatusBadge, ToneTile,
 * EmptyState). Tones map to theme tokens, never to raw Tailwind palette hues —
 * this is what replaces the app's scattered bg-blue-50/text-emerald-600 pattern.
 */
export type Tone = 'brand' | 'info' | 'success' | 'warning' | 'danger' | 'neutral';
