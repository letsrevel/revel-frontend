<script lang="ts">
	import type { Component } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';
	import type { Tone } from './tones';

	interface Props extends HTMLAttributes<HTMLSpanElement> {
		tone: Tone;
		/** Already-translated label — i18n stays at the call site. */
		label: string;
		icon?: Component;
		size?: 'sm' | 'md' | 'lg';
		class?: string;
	}
	const {
		tone,
		label,
		icon: Icon,
		size = 'md',
		class: className = '',
		...restProps
	}: Props = $props();

	// Solid fills only: every fg/bg pair below is a token pair enforced at
	// >= 4.5:1 by scripts/audit-brand-themes.py in BOTH modes. No alpha here —
	// that keeps this component fully covered by the audit, no hand math.
	const toneClasses: Record<Tone, string> = {
		brand: 'bg-primary text-primary-foreground',
		info: 'bg-info text-info-foreground',
		success: 'bg-success text-success-foreground',
		warning: 'bg-highlight text-highlight-foreground',
		danger: 'bg-destructive text-destructive-foreground',
		neutral: 'bg-muted text-muted-foreground'
	};
	const sizeClasses = {
		sm: 'px-2 py-0.5 text-[11px]',
		md: 'px-2.5 py-0.5 text-xs',
		lg: 'px-3 py-1 text-sm'
	};
	const iconSizes = { sm: 'h-3 w-3', md: 'h-3 w-3', lg: 'h-3.5 w-3.5' };
</script>

<span
	class={cn(
		'inline-flex items-center gap-1 rounded-full font-bold',
		sizeClasses[size],
		toneClasses[tone],
		className
	)}
	{...restProps}
>
	{#if Icon}
		<Icon class={iconSizes[size]} aria-hidden="true" />
	{/if}
	{label}
</span>
