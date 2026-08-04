<script lang="ts">
	import type { Component } from 'svelte';
	import { cn } from '$lib/utils';
	import type { Tone } from './tones';

	interface Props {
		tone: Tone;
		icon: Component;
		size?: 'sm' | 'md' | 'lg';
		/** Accessible name; omit when the tile sits next to visible text (decorative). */
		label?: string;
		class?: string;
	}
	const { tone, icon: Icon, size = 'md', label, class: className = '' }: Props = $props();

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
		toneClasses[tone],
		className
	)}
	role={label ? 'img' : undefined}
	aria-label={label}
	aria-hidden={label ? undefined : true}
>
	<Icon class={iconSizes[size]} aria-hidden="true" />
</span>
