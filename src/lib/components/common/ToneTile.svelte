<script lang="ts">
	import type { Component } from 'svelte';
	import { cn } from '$lib/utils';
	import type { Tone, PosterTint } from './tones';

	interface Base {
		icon: Component;
		size?: 'sm' | 'md' | 'lg';
		/** Accessible name; omit when the tile sits next to visible text (decorative). */
		label?: string;
		class?: string;
	}
	/**
	 * `tone` (semantic, e.g. danger/success) and `tint` (fixed poster-palette
	 * identity, e.g. the admin quick-actions grid) are additive and at least
	 * one is required — this union enforces that at the type level. Three
	 * legal shapes: tone-only, tint-only, or both (in which case `tint` wins —
	 * see the tintClasses branch below; this lets a caller migrate from tone
	 * to tint without an intermediate broken state). Fixed by PR 7's follow-up
	 * round once `tint` gained callers with no semantic tone to fall back to —
	 * an earlier "tone always required" design forced pointless filler tones.
	 */
	type Props = Base & ({ tone: Tone; tint?: PosterTint } | { tone?: Tone; tint: PosterTint });

	const { tone, tint, icon: Icon, size = 'md', label, class: className = '' }: Props = $props();

	// Soft tint + strong icon (replaces the app's hand-picked bg-blue-50
	// dark:bg-blue-950 tiles). The composited tint is ~the surface color, so the
	// icon-vs-surface ratio governs; independently recomputed >= 3:1 (WCAG 1.4.11,
	// non-text) in both modes — composited alpha is invisible to
	// scripts/audit-brand-themes.py. Ratios as (light page/card | dark page/card):
	//   brand 5.3/5.9 | 5.9/5.3 · info 8.3/9.3 | 8.0/7.2 · success 4.4/4.9 | 8.7/7.8
	//   danger 7.2/8.1 | 12.0/11.0 (dark flips to white icon on /25 red tint —
	//   dark destructive text on the /10 tint measured 2.95:1, under the floor)
	//   warning 12.6/13.9 | 6.7/6.0 (amber on light is 1.8:1 -> highlight-foreground)
	// Recompute if any of these token values move.
	const toneClasses: Record<Tone, string> = {
		brand: 'bg-primary/10 text-primary',
		info: 'bg-info/10 text-info',
		success: 'bg-success/10 text-success',
		warning: 'bg-highlight/20 text-highlight-foreground dark:text-highlight',
		danger:
			'bg-destructive/10 text-destructive dark:bg-destructive/25 dark:text-destructive-foreground',
		neutral: 'bg-muted text-muted-foreground'
	};
	// Identity tint axis: SOLID fixed poster chips, same classes in both modes
	// (imagery rule). Every pair is audited in scripts/audit-brand-themes.py
	// TEXT_PAIRS (poster panels + "identity tile: ink icon on lavender"). The
	// chip itself is mode-inert, but the card/page surface it sits on is NOT
	// (bg-card flips light<->dark) — ink-on-dark-card measured 1.04:1 and
	// paper-on-light-card 1.15:1, both invisible boundaries. `ring-1 ring-inset
	// ring-border` gives every tint chip a theme-aware edge so it reads against
	// either surface; verified visually in both modes (see rebrand-report.md).
	const tintClasses: Record<PosterTint, string> = {
		purple: 'bg-poster-purple text-poster-white ring-1 ring-inset ring-border',
		lavender: 'bg-poster-lavender text-poster-ink ring-1 ring-inset ring-border',
		periwinkle: 'bg-poster-periwinkle text-poster-ink ring-1 ring-inset ring-border',
		amber: 'bg-poster-amber text-poster-ink ring-1 ring-inset ring-border',
		crimson: 'bg-poster-crimson-deep text-poster-white ring-1 ring-inset ring-border',
		ink: 'bg-poster-ink text-poster-white ring-1 ring-inset ring-border',
		paper: 'bg-poster-paper text-poster-ink ring-1 ring-inset ring-border'
	};
	const sizeClasses = {
		sm: 'h-8 w-8 rounded-md',
		md: 'h-10 w-10 rounded-md',
		lg: 'h-12 w-12 rounded-lg'
	};
	const iconSizes = { sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-6 w-6' };
</script>

<span
	class={cn(
		'inline-flex shrink-0 items-center justify-center',
		sizeClasses[size],
		tint ? tintClasses[tint] : toneClasses[tone],
		className
	)}
	role={label ? 'img' : undefined}
	aria-label={label}
	aria-hidden={label ? undefined : true}
>
	<Icon class={iconSizes[size]} aria-hidden="true" />
</span>
