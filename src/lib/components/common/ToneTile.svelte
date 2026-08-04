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
	// icon-vs-surface ratio governs; every pair below is >= 3:1 (WCAG 1.4.11,
	// non-text) in both modes. These are no longer hand-verified: they are
	// COMPOSITED_PAIRS entries in scripts/audit-brand-themes.py (issue #783),
	// which prints them. Ratios as (light page/card | dark page/card):
	//   brand 5.29/5.94 | 5.93/5.35 · info 8.29/9.32 | 7.97/7.16
	//   success 4.39/4.93 | 8.71/7.84 · danger 7.20/8.10 | 5.84/5.37
	//   warning 12.55/13.90 | 6.63/5.96 (amber on light is 1.8:1 -> the
	//   -foreground swap; the dark tone keeps the amber itself)
	// The danger tone kept its dark /25 tint bump — a /10 red wash is close to
	// invisible on the aubergine surface — but no longer whites out the icon:
	// `text-destructive` resolves to --destructive-text, the AA-safe half of the
	// split token (issue #781), instead of the fill value that measured 2.95:1.
	// Re-run the audit script if any of these token values move.
	const toneClasses: Record<Tone, string> = {
		brand: 'bg-primary/10 text-primary',
		info: 'bg-info/10 text-info',
		success: 'bg-success/10 text-success',
		warning: 'bg-highlight/20 text-highlight-foreground dark:text-highlight',
		danger: 'bg-destructive/10 text-destructive dark:bg-destructive/25',
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
