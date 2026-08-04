<script lang="ts">
	import type { Component } from 'svelte';
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
	// icon-vs-surface ratio governs; hand-verified >= 3:1 (WCAG 1.4.11, non-text)
	// in both modes — composited alpha is invisible to audit-brand-themes.py:
	//   brand 7.0/5.8 · info 10.1/8.0 · success 5.7/8.8 · danger 9.8/3.1
	//   warning: amber on light is 1.8:1 (fails) -> highlight-foreground ~16:1;
	//   dark flips to amber itself, 8.4:1. Ratios recomputed if token values move.
	const toneClasses: Record<Tone, string> = {
		brand: 'bg-primary/10 text-primary',
		info: 'bg-info/10 text-info',
		success: 'bg-success/10 text-success',
		warning: 'bg-highlight/20 text-highlight-foreground dark:text-highlight',
		danger: 'bg-destructive/10 text-destructive',
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
	class="inline-flex shrink-0 items-center justify-center {sizeClasses[size]} {toneClasses[
		tone
	]} {className}"
	role={label ? 'img' : undefined}
	aria-label={label}
	aria-hidden={label ? undefined : true}
>
	<Icon class={iconSizes[size]} aria-hidden="true" />
</span>
